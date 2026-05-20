import { Router } from "express";
import { z } from "zod";
import { NotificationType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { pushToMany } from "../lib/realtime";
import { notify } from "../services/notify";

export const chatRouter = Router({ mergeParams: true });

chatRouter.use(requireAuth);

/** Cek user adalah member project (atau admin / owner). */
async function ensureProjectAccess(projectId: string, userId: string, role: Role) {
  if (role === Role.ADMIN_PROJECT) return true;
  const proj = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, members: { where: { userId }, select: { id: true } } },
  });
  if (!proj) return false;
  return proj.ownerId === userId || proj.members.length > 0;
}

/** Ambil semua user yang berhak nerima event chat di project ini. */
async function projectAudience(projectId: string): Promise<string[]> {
  const proj = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      members: { select: { userId: true } },
    },
  });
  if (!proj) return [];
  const ids = new Set<string>([proj.ownerId, ...proj.members.map((m) => m.userId)]);
  return [...ids];
}

/**
 * Parse body untuk cari mention `@nama` lalu cocokkan ke user di project.
 * Return: array userId unik yang di-mention.
 */
async function resolveMentions(projectId: string, body: string): Promise<string[]> {
  const tokens = Array.from(body.matchAll(/@([\p{L}\p{N}_.\-]+)/gu)).map((m) => m[1]);
  if (tokens.length === 0) return [];

  // Kandidat audience project
  const audience = await projectAudience(projectId);
  if (audience.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: audience } },
    select: { id: true, name: true, email: true },
  });

  const matched = new Set<string>();
  for (const t of tokens) {
    const tl = t.toLowerCase();
    const u = users.find(
      (u) =>
        u.name.toLowerCase().replace(/\s+/g, "").startsWith(tl) ||
        u.email.toLowerCase().split("@")[0].startsWith(tl)
    );
    if (u) matched.add(u.id);
  }
  return [...matched];
}

/**
 * GET /api/projects/:projectId/messages?before=<id>&limit=50
 */
chatRouter.get("/", async (req, res, next) => {
  try {
    const me = req.user!;
    const { projectId } = req.params as { projectId: string };
    if (!(await ensureProjectAccess(projectId, me.id, me.role))) {
      return res.status(403).json({ error: "Tidak punya akses ke chat project ini" });
    }

    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const before = req.query.before ? String(req.query.before) : undefined;

    const messages = await prisma.chatMessage.findMany({
      where: {
        projectId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        embedTask: { select: { id: true, title: true, status: true, progress: true } },
        mentions: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json(messages.reverse());
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/projects/:projectId/messages/pinned
 */
chatRouter.get("/pinned", async (req, res, next) => {
  try {
    const me = req.user!;
    const { projectId } = req.params as { projectId: string };
    if (!(await ensureProjectAccess(projectId, me.id, me.role))) {
      return res.status(403).json({ error: "Tidak punya akses" });
    }
    const items = await prisma.chatMessage.findMany({
      where: { projectId, isPinned: true },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        embedTask: { select: { id: true, title: true, status: true, progress: true } },
      },
      orderBy: { pinnedAt: "desc" },
    });
    res.json(items);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/projects/:projectId/messages
 *   body: { body, embedTaskId? }
 */
chatRouter.post("/", async (req, res, next) => {
  try {
    const me = req.user!;
    const { projectId } = req.params as { projectId: string };
    if (!(await ensureProjectAccess(projectId, me.id, me.role))) {
      return res.status(403).json({ error: "Tidak punya akses" });
    }

    const body = z
      .object({
        body: z.string().min(1).max(4000),
        embedTaskId: z.string().optional().nullable(),
      })
      .parse(req.body);

    const mentionIds = await resolveMentions(projectId, body.body);

    const msg = await prisma.chatMessage.create({
      data: {
        projectId,
        authorId: me.id,
        body: body.body,
        embedTaskId: body.embedTaskId ?? null,
        mentions: mentionIds.length
          ? { create: mentionIds.map((uid) => ({ userId: uid })) }
          : undefined,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        embedTask: { select: { id: true, title: true, status: true, progress: true } },
        mentions: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    // Realtime broadcast ke seluruh audience project (kecuali pengirim)
    const audience = await projectAudience(projectId);
    pushToMany(
      audience.filter((uid) => uid !== me.id),
      { type: "chat.message", payload: msg }
    );

    // Kirim notifikasi ke user yang di-mention (kecuali diri sendiri)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, code: true },
    });
    for (const uid of mentionIds) {
      if (uid === me.id) continue;
      await notify({
        userId: uid,
        type: NotificationType.MENTION,
        title: `${me.name} menyebut Anda di ${project?.code ?? "chat"}`,
        body: body.body.slice(0, 160),
        link: `/projects/${projectId}?tab=chat&msg=${msg.id}`,
      });
    }

    res.status(201).json(msg);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/projects/:projectId/messages/:id/pin
 *   body: { pinned: boolean }
 */
chatRouter.post("/:id/pin", async (req, res, next) => {
  try {
    const me = req.user!;
    const { projectId, id } = req.params as { projectId: string; id: string };
    if (!(await ensureProjectAccess(projectId, me.id, me.role))) {
      return res.status(403).json({ error: "Tidak punya akses" });
    }
    const body = z.object({ pinned: z.boolean() }).parse(req.body);
    const msg = await prisma.chatMessage.update({
      where: { id },
      data: {
        isPinned: body.pinned,
        pinnedAt: body.pinned ? new Date() : null,
        pinnedById: body.pinned ? me.id : null,
      },
    });

    const audience = await projectAudience(projectId);
    pushToMany(audience, { type: "chat.pin", payload: msg });
    res.json(msg);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/projects/:projectId/messages/read — update marker baca user.
 */
chatRouter.post("/read", async (req, res, next) => {
  try {
    const me = req.user!;
    const { projectId } = req.params as { projectId: string };
    if (!(await ensureProjectAccess(projectId, me.id, me.role))) {
      return res.status(403).json({ error: "Tidak punya akses" });
    }
    const r = await prisma.chatRead.upsert({
      where: { projectId_userId: { projectId, userId: me.id } },
      update: { lastReadAt: new Date() },
      create: { projectId, userId: me.id, lastReadAt: new Date() },
    });
    res.json(r);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/projects/:projectId/messages/unread — jumlah unread untuk user.
 */
chatRouter.get("/unread", async (req, res, next) => {
  try {
    const me = req.user!;
    const { projectId } = req.params as { projectId: string };
    if (!(await ensureProjectAccess(projectId, me.id, me.role))) {
      return res.json({ count: 0 });
    }
    const r = await prisma.chatRead.findUnique({
      where: { projectId_userId: { projectId, userId: me.id } },
    });
    const count = await prisma.chatMessage.count({
      where: {
        projectId,
        authorId: { not: me.id },
        ...(r ? { createdAt: { gt: r.lastReadAt } } : {}),
      },
    });
    res.json({ count });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/projects/:projectId/messages/:id
 *   Hanya author atau admin yang bisa hapus.
 */
chatRouter.delete("/:id", async (req, res, next) => {
  try {
    const me = req.user!;
    const { projectId, id } = req.params as { projectId: string; id: string };
    const msg = await prisma.chatMessage.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ error: "Pesan tidak ditemukan" });
    if (msg.authorId !== me.id && me.role !== Role.ADMIN_PROJECT) {
      return res.status(403).json({ error: "Tidak punya izin menghapus" });
    }
    await prisma.chatMessage.delete({ where: { id } });
    const audience = await projectAudience(projectId);
    pushToMany(audience, { type: "chat.message.deleted", payload: { id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
