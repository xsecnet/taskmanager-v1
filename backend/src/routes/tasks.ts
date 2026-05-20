import { Router } from "express";
import { z } from "zod";
import { ActivityType, NotificationType, Role, TaskStatus, TaskPriority } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../services/activity";
import { notify } from "../services/notify";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

const taskCreateSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  division: z.nativeEnum(Role),
  priority: z.nativeEnum(TaskPriority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  startAt: z.coerce.date().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  weight: z.number().int().min(1).max(100).optional(),
});

const taskUpdateSchema = taskCreateSchema.partial().extend({
  progress: z.number().int().min(0).max(100).optional(),
  completedAt: z.coerce.date().optional().nullable(),
});

/**
 * Helper: rollup progress project dari rata-rata task progress.
 */
async function rollupProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId, status: { not: TaskStatus.CANCELLED } },
    select: { progress: true },
  });
  const avg = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length)
    : 0;
  await prisma.project.update({ where: { id: projectId }, data: { progress: avg } });
}

/**
 * GET /api/tasks
 * Filter: ?projectId=&division=&status=&assigneeId=&mine=true
 */
tasksRouter.get("/", async (req, res, next) => {
  try {
    const me = req.user!;
    const q = req.query;

    const where: any = {};
    if (q.projectId) where.projectId = String(q.projectId);
    if (q.division) where.division = q.division;
    if (q.status) where.status = q.status;
    if (q.assigneeId) where.assigneeId = String(q.assigneeId);
    if (q.mine === "true") where.assigneeId = me.id;

    // Non-admin hanya boleh melihat task di project di mana dia member/owner,
    // atau task untuk divisinya.
    if (me.role !== Role.ADMIN_PROJECT) {
      where.OR = [
        { assigneeId: me.id },
        { division: me.role },
        { project: { ownerId: me.id } },
        { project: { members: { some: { userId: me.id } } } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, code: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { updates: true, reminders: true } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });
    res.json(tasks);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/tasks/:id
 */
tasksRouter.get("/:id", async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        project: { select: { id: true, name: true, code: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, email: true } },
        updates: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" },
        },
        subtasks: {
          include: { assignee: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        },
        attachments: {
          include: { uploader: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" },
        },
        reminders: { orderBy: { remindAt: "asc" } },
      },
    });
    if (!task) return res.status(404).json({ error: "Task tidak ditemukan" });
    res.json(task);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/tasks/from-message — convert pesan chat jadi task baru.
 *   body: { messageId, title?, division?, dueAt?, assigneeId? }
 */
tasksRouter.post("/from-message", async (req, res, next) => {
  try {
    const me = req.user!;
    const body = z
      .object({
        messageId: z.string(),
        title: z.string().min(1).optional(),
        division: z.nativeEnum(Role).optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        dueAt: z.coerce.date().optional().nullable(),
        assigneeId: z.string().optional().nullable(),
      })
      .parse(req.body);

    const msg = await prisma.chatMessage.findUnique({
      where: { id: body.messageId },
      include: { author: { select: { name: true } } },
    });
    if (!msg) return res.status(404).json({ error: "Pesan tidak ditemukan" });

    const title = body.title?.trim() || msg.body.slice(0, 80);

    const task = await prisma.task.create({
      data: {
        projectId: msg.projectId,
        creatorId: me.id,
        title,
        description: `Dari chat oleh ${msg.author.name}:\n\n${msg.body}`,
        division: body.division ?? me.role,
        priority: body.priority ?? TaskPriority.MEDIUM,
        status: TaskStatus.TODO,
        dueAt: body.dueAt ?? null,
        assigneeId: body.assigneeId ?? null,
      },
    });

    // Update pesan agar embed task baru ini
    await prisma.chatMessage.update({
      where: { id: msg.id },
      data: { embedTaskId: task.id },
    });

    await logActivity({
      type: ActivityType.TASK_CREATED,
      actorId: me.id,
      projectId: task.projectId,
      taskId: task.id,
      message: `${me.name} mengonversi pesan menjadi task "${task.title}"`,
    });

    if (task.assigneeId && task.assigneeId !== me.id) {
      await notify({
        userId: task.assigneeId,
        type: NotificationType.TASK_ASSIGNED,
        title: `${me.name} menugaskan Anda`,
        body: `Task dari chat: "${task.title}"`,
        link: `/tasks/${task.id}`,
      });
    }

    await rollupProjectProgress(task.projectId);
    res.status(201).json(task);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/tasks
 */
tasksRouter.post("/", async (req, res, next) => {
  try {
    const me = req.user!;
    const body = taskCreateSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        projectId: body.projectId,
        title: body.title,
        description: body.description ?? null,
        division: body.division,
        priority: body.priority ?? TaskPriority.MEDIUM,
        status: body.status ?? TaskStatus.TODO,
        startAt: body.startAt ?? null,
        dueAt: body.dueAt ?? null,
        assigneeId: body.assigneeId ?? null,
        weight: body.weight ?? 1,
        creatorId: me.id,
      },
    });

    await logActivity({
      type: ActivityType.TASK_CREATED,
      actorId: me.id,
      projectId: task.projectId,
      taskId: task.id,
      message: `${me.name} membuat task "${task.title}"`,
    });

    // Notif assignee saat dibuat sudah punya assignee
    if (task.assigneeId && task.assigneeId !== me.id) {
      await notify({
        userId: task.assigneeId,
        type: NotificationType.TASK_ASSIGNED,
        title: `${me.name} menugaskan Anda`,
        body: `Task baru: "${task.title}"`,
        link: `/tasks/${task.id}`,
      });
    }

    await rollupProjectProgress(task.projectId);
    res.status(201).json(task);
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /api/tasks/:id
 */
tasksRouter.patch("/:id", async (req, res, next) => {
  try {
    const me = req.user!;
    const body = taskUpdateSchema.parse(req.body);

    const before = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: "Task tidak ditemukan" });

    const data: any = { ...body };
    // jika status DONE, set completedAt = now()
    if (body.status === TaskStatus.DONE) {
      data.completedAt = body.completedAt ?? new Date();
      data.progress = 100;
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data,
    });

    if (body.status && body.status !== before.status) {
      await logActivity({
        type: ActivityType.TASK_STATUS_CHANGED,
        actorId: me.id,
        projectId: task.projectId,
        taskId: task.id,
        message: `${me.name} mengubah status "${task.title}" → ${task.status}`,
      });
      // Notif ke assignee (kecuali dia sendiri yg mengubah)
      if (task.assigneeId && task.assigneeId !== me.id) {
        await notify({
          userId: task.assigneeId,
          type: NotificationType.TASK_STATUS_CHANGED,
          title: `Status task diubah → ${task.status}`,
          body: `"${task.title}" oleh ${me.name}`,
          link: `/tasks/${task.id}`,
        });
      }
    }
    if (body.assigneeId !== undefined && body.assigneeId !== before.assigneeId) {
      const assigneeName = body.assigneeId
        ? (await prisma.user.findUnique({ where: { id: body.assigneeId }, select: { name: true } }))?.name
        : null;
      await logActivity({
        type: ActivityType.TASK_ASSIGNED,
        actorId: me.id,
        projectId: task.projectId,
        taskId: task.id,
        message: assigneeName
          ? `${me.name} menugaskan "${task.title}" ke ${assigneeName}`
          : `${me.name} menghapus assignee "${task.title}"`,
      });
      if (body.assigneeId && body.assigneeId !== me.id) {
        await notify({
          userId: body.assigneeId,
          type: NotificationType.TASK_ASSIGNED,
          title: `${me.name} menugaskan Anda`,
          body: `"${task.title}"`,
          link: `/tasks/${task.id}`,
        });
      }
    }

    await rollupProjectProgress(task.projectId);
    res.json(task);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/tasks/:id/updates — tambah catatan progress.
 */
tasksRouter.post("/:id/updates", async (req, res, next) => {
  try {
    const me = req.user!;
    const body = z
      .object({
        note: z.string().min(1),
        progress: z.number().int().min(0).max(100).optional(),
        status: z.nativeEnum(TaskStatus).optional(),
      })
      .parse(req.body);

    const update = await prisma.taskUpdate.create({
      data: {
        taskId: req.params.id,
        authorId: me.id,
        note: body.note,
        progress: body.progress,
        status: body.status,
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Sinkronkan ke task induk
    if (body.progress !== undefined || body.status) {
      const data: any = {};
      if (body.progress !== undefined) data.progress = body.progress;
      if (body.status) {
        data.status = body.status;
        if (body.status === TaskStatus.DONE) {
          data.completedAt = new Date();
          data.progress = 100;
        }
      }
      const task = await prisma.task.update({ where: { id: req.params.id }, data });
      await rollupProjectProgress(task.projectId);
    }

    res.status(201).json(update);
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/tasks/:id
 */
tasksRouter.delete("/:id", async (req, res, next) => {
  try {
    const task = await prisma.task.delete({ where: { id: req.params.id } });
    await rollupProjectProgress(task.projectId);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
