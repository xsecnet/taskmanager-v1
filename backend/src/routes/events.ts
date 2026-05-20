import { Router } from "express";
import { registerClient } from "../lib/realtime";
import { verifySession } from "../lib/jwt";
import { config } from "../lib/config";
import { prisma } from "../lib/prisma";

export const eventsRouter = Router();

/**
 * GET /api/events  (Server-Sent Events)
 *
 * Browser tidak bisa kirim cookie via EventSource lintas-domain dengan
 * mudah, jadi kita auth ulang manual via cookie request.
 */
eventsRouter.get("/", async (req, res) => {
  const token = req.cookies?.[config.cookieName];
  if (!token) return res.status(401).end();
  let session: ReturnType<typeof verifySession>;
  try {
    session = verifySession(token);
  } catch {
    return res.status(401).end();
  }

  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user || !user.isActive) return res.status(401).end();

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  registerClient(user.id, res);
});
