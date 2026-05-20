import { Router } from "express";
import { Role, TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

/**
 * GET /api/dashboard — ringkasan untuk halaman utama.
 */
dashboardRouter.get("/", async (req, res, next) => {
  try {
    const me = req.user!;

    const visibleTaskWhere: any =
      me.role === Role.ADMIN_PROJECT
        ? {}
        : {
            OR: [
              { assigneeId: me.id },
              { division: me.role },
              { project: { ownerId: me.id } },
              { project: { members: { some: { userId: me.id } } } },
            ],
          };

    const [
      totalProjects,
      activeProjects,
      tasksByStatus,
      upcomingTasks,
      overdueTasks,
      myReminders,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: "ACTIVE" } }),
      prisma.task.groupBy({
        by: ["status"],
        where: visibleTaskWhere,
        _count: { _all: true },
      }),
      prisma.task.findMany({
        where: {
          ...visibleTaskWhere,
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          dueAt: { gte: new Date() },
        },
        include: {
          project: { select: { id: true, name: true, code: true } },
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 10,
      }),
      prisma.task.findMany({
        where: {
          ...visibleTaskWhere,
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          dueAt: { lt: new Date() },
        },
        include: { project: { select: { id: true, name: true, code: true } } },
        orderBy: { dueAt: "asc" },
        take: 10,
      }),
      prisma.reminder.findMany({
        where: { userId: me.id, status: "PENDING", remindAt: { gte: new Date() } },
        include: { task: { select: { id: true, title: true } } },
        orderBy: { remindAt: "asc" },
        take: 10,
      }),
    ]);

    res.json({
      totalProjects,
      activeProjects,
      tasksByStatus,
      upcomingTasks,
      overdueTasks,
      myReminders,
    });
  } catch (e) {
    next(e);
  }
});
