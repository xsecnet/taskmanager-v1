import { Router } from "express";
import { z } from "zod";
import { ActivityType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../services/activity";

export const subtasksRouter = Router({ mergeParams: true });

subtasksRouter.use(requireAuth);

const createSchema = z.object({
  title: z.string().min(1),
  assigneeId: z.string().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  isDone: z.boolean().optional(),
  assigneeId: z.string().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  position: z.number().int().optional(),
});

/**
 * Hitung ulang progress task dari rasio subtask yang done.
 * Hanya di-apply kalau task punya minimal 1 subtask, supaya update
 * manual via TaskUpdate tetap berfungsi untuk task tanpa subtask.
 */
async function rollupTaskProgressFromSubtasks(taskId: string) {
  const subs = await prisma.subtask.findMany({ where: { taskId } });
  if (subs.length === 0) return;
  const done = subs.filter((s) => s.isDone).length;
  const progress = Math.round((done / subs.length) * 100);
  await prisma.task.update({ where: { id: taskId }, data: { progress } });
}

/**
 * GET /api/tasks/:taskId/subtasks
 */
subtasksRouter.get("/", async (req, res, next) => {
  try {
    const { taskId } = req.params as { taskId: string };
    const subs = await prisma.subtask.findMany({
      where: { taskId },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    res.json(subs);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/tasks/:taskId/subtasks
 */
subtasksRouter.post("/", async (req, res, next) => {
  try {
    const me = req.user!;
    const { taskId } = req.params as { taskId: string };
    const body = createSchema.parse(req.body);

    const last = await prisma.subtask.findFirst({
      where: { taskId },
      orderBy: { position: "desc" },
    });
    const position = (last?.position ?? -1) + 1;

    const sub = await prisma.subtask.create({
      data: {
        taskId,
        title: body.title,
        assigneeId: body.assigneeId ?? null,
        dueAt: body.dueAt ?? null,
        position,
      },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true, title: true },
    });
    await logActivity({
      type: ActivityType.SUBTASK_CREATED,
      actorId: me.id,
      projectId: task?.projectId ?? null,
      taskId,
      message: `${me.name} menambahkan sub-tugas "${sub.title}"`,
    });

    await rollupTaskProgressFromSubtasks(taskId);
    res.status(201).json(sub);
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /api/tasks/:taskId/subtasks/:id
 */
subtasksRouter.patch("/:id", async (req, res, next) => {
  try {
    const me = req.user!;
    const { taskId, id } = req.params as { taskId: string; id: string };
    const body = updateSchema.parse(req.body);

    const before = await prisma.subtask.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: "Sub-tugas tidak ditemukan" });

    const data: any = { ...body };
    if (body.isDone === true && !before.isDone) data.completedAt = new Date();
    if (body.isDone === false && before.isDone) data.completedAt = null;

    const sub = await prisma.subtask.update({
      where: { id },
      data,
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (body.isDone === true && !before.isDone) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { projectId: true },
      });
      await logActivity({
        type: ActivityType.SUBTASK_COMPLETED,
        actorId: me.id,
        projectId: task?.projectId ?? null,
        taskId,
        message: `${me.name} menyelesaikan "${sub.title}"`,
      });
    }

    await rollupTaskProgressFromSubtasks(taskId);
    res.json(sub);
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/tasks/:taskId/subtasks/:id
 */
subtasksRouter.delete("/:id", async (req, res, next) => {
  try {
    const me = req.user!;
    const { taskId, id } = req.params as { taskId: string; id: string };
    const sub = await prisma.subtask.delete({ where: { id } });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    await logActivity({
      type: ActivityType.SUBTASK_DELETED,
      actorId: me.id,
      projectId: task?.projectId ?? null,
      taskId,
      message: `${me.name} menghapus "${sub.title}"`,
    });

    await rollupTaskProgressFromSubtasks(taskId);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
