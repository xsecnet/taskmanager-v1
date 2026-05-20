import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const activityRouter = Router();

activityRouter.use(requireAuth);

/**
 * GET /api/activity
 *   ?projectId=... | ?taskId=... | ?limit=20
 *
 * Tanpa filter: ambil aktivitas yang relevan untuk user
 * (project dia member/owner, task untuk divisinya, atau yang dia kerjakan).
 */
activityRouter.get("/", async (req, res, next) => {
  try {
    const me = req.user!;
    const limit = Math.min(Number(req.query.limit ?? 30), 100);
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    const taskId = req.query.taskId ? String(req.query.taskId) : undefined;

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (taskId) where.taskId = taskId;

    if (!projectId && !taskId && me.role !== Role.ADMIN_PROJECT) {
      where.OR = [
        { actorId: me.id },
        { project: { ownerId: me.id } },
        { project: { members: { some: { userId: me.id } } } },
        { task: { assigneeId: me.id } },
        { task: { division: me.role } },
      ];
    }

    const items = await prisma.activityLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } },
        project: { select: { id: true, name: true, code: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json(items);
  } catch (e) {
    next(e);
  }
});
