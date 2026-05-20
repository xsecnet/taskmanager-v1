import type { Request, Response, NextFunction } from "express";
import { verifySession, type SessionPayload } from "../lib/jwt";
import { config } from "../lib/config";
import { prisma } from "../lib/prisma";
import type { Role, User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: SessionPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[config.cookieName];
  if (!token) return res.status(401).json({ error: "Tidak ada sesi" });
  try {
    const session = verifySession(token);
    const user = await prisma.user.findUnique({ where: { id: session.uid } });
    if (!user || !user.isActive) return res.status(401).json({ error: "User tidak aktif" });
    req.session = session;
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Sesi tidak valid" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Belum login" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Akses ditolak untuk role ini" });
    }
    next();
  };
}
