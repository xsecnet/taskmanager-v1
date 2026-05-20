import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const usersRouter = Router();

usersRouter.use(requireAuth);

/**
 * GET /api/users — list semua user (untuk dropdown assignee).
 */
usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});

/**
 * PATCH /api/users/:id — admin update role / status user.
 */
usersRouter.patch(
  "/:id",
  requireRole(Role.ADMIN_PROJECT),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          role: z.nativeEnum(Role).optional(),
          isActive: z.boolean().optional(),
        })
        .parse(req.body);
      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: body,
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);
