import { Router } from "express";
import { z } from "zod";
import { ReminderChannel, ReminderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const remindersRouter = Router();

remindersRouter.use(requireAuth);

const createSchema = z.object({
  taskId: z.string(),
  userId: z.string().optional(), // default: penerima = current user
  remindAt: z.coerce.date(),
  channel: z.nativeEnum(ReminderChannel).optional(),
  message: z.string().optional().nullable(),
});

/**
 * GET /api/reminders?taskId=&mine=true
 */
remindersRouter.get("/", async (req, res, next) => {
  try {
    const me = req.user!;
    const where: any = {};
    if (req.query.taskId) where.taskId = String(req.query.taskId);
    if (req.query.mine === "true") where.userId = me.id;
    const reminders = await prisma.reminder.findMany({
      where,
      include: {
        task: { select: { id: true, title: true, projectId: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { remindAt: "asc" },
    });
    res.json(reminders);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/reminders
 */
remindersRouter.post("/", async (req, res, next) => {
  try {
    const me = req.user!;
    const body = createSchema.parse(req.body);
    const reminder = await prisma.reminder.create({
      data: {
        taskId: body.taskId,
        userId: body.userId ?? me.id,
        remindAt: body.remindAt,
        channel: body.channel ?? ReminderChannel.BOTH,
        message: body.message ?? null,
        status: ReminderStatus.PENDING,
      },
    });
    res.status(201).json(reminder);
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/reminders/:id
 */
remindersRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.reminder.update({
      where: { id: req.params.id },
      data: { status: ReminderStatus.CANCELLED },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
