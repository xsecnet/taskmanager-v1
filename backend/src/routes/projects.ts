import { Router } from "express";
import { z } from "zod";
import { ActivityType, ProjectStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { logActivity } from "../services/activity";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

const projectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(50),
  description: z.string().optional().nullable(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  memberIds: z.array(z.string()).optional(),
});

/**
 * GET /api/projects — Admin lihat semua, role lain hanya project di mana dia member/owner.
 */
projectsRouter.get("/", async (req, res) => {
  const me = req.user!;
  const where =
    me.role === Role.ADMIN_PROJECT
      ? {}
      : {
          OR: [
            { ownerId: me.id },
            { members: { some: { userId: me.id } } },
          ],
        };

  const projects = await prisma.project.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { tasks: true, members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(projects);
});

/**
 * GET /api/projects/:id
 */
projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
          },
        },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!project) return res.status(404).json({ error: "Project tidak ditemukan" });
    res.json(project);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/projects — admin only.
 */
projectsRouter.post(
  "/",
  requireRole(Role.ADMIN_PROJECT),
  async (req, res, next) => {
    try {
      const body = projectSchema.parse(req.body);
      const me = req.user!;
      const project = await prisma.project.create({
        data: {
          name: body.name,
          code: body.code,
          description: body.description ?? null,
          status: body.status ?? ProjectStatus.PLANNING,
          startDate: body.startDate ?? null,
          endDate: body.endDate ?? null,
          ownerId: me.id,
          members: body.memberIds && body.memberIds.length
            ? {
                create: body.memberIds.map((uid) => ({
                  userId: uid,
                  role: Role.NETWORK_ENGINEER, // default; admin bisa update belakangan
                })),
              }
            : undefined,
        },
      });

      await logActivity({
        type: ActivityType.PROJECT_CREATED,
        actorId: me.id,
        projectId: project.id,
        message: `${me.name} membuat project "${project.name}" (${project.code})`,
      });

      res.status(201).json(project);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * PATCH /api/projects/:id — admin only.
 */
projectsRouter.patch(
  "/:id",
  requireRole(Role.ADMIN_PROJECT),
  async (req, res, next) => {
    try {
      const body = projectSchema.partial().parse(req.body);
      const updated = await prisma.project.update({
        where: { id: req.params.id },
        data: {
          name: body.name,
          code: body.code,
          description: body.description,
          status: body.status,
          startDate: body.startDate,
          endDate: body.endDate,
        },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * POST /api/projects/:id/members — tambah member dengan role tertentu.
 */
projectsRouter.post(
  "/:id/members",
  requireRole(Role.ADMIN_PROJECT),
  async (req, res, next) => {
    try {
      const body = z
        .object({ userId: z.string(), role: z.nativeEnum(Role) })
        .parse(req.body);
      const member = await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: req.params.id, userId: body.userId } },
        update: { role: body.role },
        create: { projectId: req.params.id, userId: body.userId, role: body.role },
      });

      const [user, project] = await Promise.all([
        prisma.user.findUnique({ where: { id: body.userId }, select: { name: true } }),
        prisma.project.findUnique({ where: { id: req.params.id }, select: { name: true } }),
      ]);
      await logActivity({
        type: ActivityType.MEMBER_ADDED,
        actorId: req.user!.id,
        projectId: req.params.id,
        message: `${req.user!.name} menambahkan ${user?.name ?? "anggota"} ke "${project?.name ?? "project"}"`,
      });

      res.status(201).json(member);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * DELETE /api/projects/:id/members/:userId
 */
projectsRouter.delete(
  "/:id/members/:userId",
  requireRole(Role.ADMIN_PROJECT),
  async (req, res, next) => {
    try {
      await prisma.projectMember.delete({
        where: {
          projectId_userId: { projectId: req.params.id, userId: req.params.userId },
        },
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  }
);

/**
 * DELETE /api/projects/:id
 */
projectsRouter.delete(
  "/:id",
  requireRole(Role.ADMIN_PROJECT),
  async (req, res, next) => {
    try {
      await prisma.project.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  }
);
