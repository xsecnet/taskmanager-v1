import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { getVapidPublicKey, isPushConfigured } from "../lib/push";

export const pushRouter = Router();

pushRouter.use(requireAuth);

/**
 * GET /api/push/public-key — kirim VAPID public key ke client untuk subscribe.
 */
pushRouter.get("/public-key", (_req, res) => {
  res.json({
    publicKey: getVapidPublicKey(),
    enabled: isPushConfigured(),
  });
});

const subSchema = z.object({
  endpoint: z.string().url().max(500),
  keys: z.object({
    p256dh: z.string().max(255),
    auth: z.string().max(255),
  }),
  userAgent: z.string().max(500).optional(),
});

/**
 * POST /api/push/subscribe
 *   Body sesuai PushSubscription.toJSON() di browser.
 *   Idempotent — endpoint unik, upsert berdasarkan endpoint.
 */
pushRouter.post("/subscribe", async (req, res, next) => {
  try {
    const me = req.user!;
    const body = subSchema.parse(req.body);

    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint: body.endpoint },
    });

    if (existing) {
      // Pindahkan kepemilikan kalau user berbeda (misal sharing browser)
      const sub = await prisma.pushSubscription.update({
        where: { endpoint: body.endpoint },
        data: {
          userId: me.id,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          userAgent: body.userAgent,
          lastUsedAt: new Date(),
        },
      });
      return res.json(sub);
    }

    const sub = await prisma.pushSubscription.create({
      data: {
        userId: me.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: body.userAgent,
      },
    });
    res.status(201).json(sub);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/push/unsubscribe
 */
pushRouter.post("/unsubscribe", async (req, res, next) => {
  try {
    const me = req.user!;
    const body = z.object({ endpoint: z.string().url() }).parse(req.body);
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: body.endpoint, userId: me.id },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
