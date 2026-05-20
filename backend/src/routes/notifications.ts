import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

/**
 * GET /api/notifications?unread=true&limit=20
 */
notificationsRouter.get("/", async (req, res, next) => {
  try {
    const me = req.user!;
    const limit = Math.min(Number(req.query.limit ?? 30), 100);
    const where: any = { userId: me.id };
    if (req.query.unread === "true") where.isRead = false;
    const items = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json(items);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/notifications/unread-count
 */
notificationsRouter.get("/unread-count", async (req, res, next) => {
  try {
    const me = req.user!;
    const count = await prisma.notification.count({
      where: { userId: me.id, isRead: false },
    });
    res.json({ count });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/notifications/read
 *   body: { ids?: string[] }  — kosong = mark semua as read.
 */
notificationsRouter.post("/read", async (req, res, next) => {
  try {
    const me = req.user!;
    const body = z.object({ ids: z.array(z.string()).optional() }).parse(req.body ?? {});
    if (body.ids && body.ids.length) {
      await prisma.notification.updateMany({
        where: { userId: me.id, id: { in: body.ids } },
        data: { isRead: true, readAt: new Date() },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: me.id, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/notifications/:id
 */
notificationsRouter.delete("/:id", async (req, res, next) => {
  try {
    const me = req.user!;
    await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: me.id },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
