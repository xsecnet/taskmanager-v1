import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { ActivityType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../services/activity";

export const attachmentsRouter = Router({ mergeParams: true });

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 16);
    const safe = randomBytes(12).toString("hex") + ext;
    cb(null, safe);
  },
});

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error(`Tipe file ${file.mimetype} tidak diperbolehkan`));
  },
});

attachmentsRouter.use(requireAuth);

/**
 * GET /api/tasks/:taskId/attachments
 */
attachmentsRouter.get("/", async (req, res, next) => {
  try {
    const { taskId } = req.params as { taskId: string };
    const items = await prisma.attachment.findMany({
      where: { taskId },
      include: {
        uploader: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/tasks/:taskId/attachments — multipart/form-data, field "file"
 */
attachmentsRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    const me = req.user!;
    const { taskId } = req.params as { taskId: string };
    if (!req.file) return res.status(400).json({ error: "File wajib di-upload" });

    const att = await prisma.attachment.create({
      data: {
        taskId,
        uploaderId: me.id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        url: `/uploads/${req.file.filename}`,
      },
      include: {
        uploader: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    await logActivity({
      type: ActivityType.ATTACHMENT_UPLOADED,
      actorId: me.id,
      projectId: task?.projectId ?? null,
      taskId,
      message: `${me.name} mengunggah file "${att.originalName}"`,
    });

    res.status(201).json(att);
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/tasks/:taskId/attachments/:id
 */
attachmentsRouter.delete("/:id", async (req, res, next) => {
  try {
    const me = req.user!;
    const { taskId, id } = req.params as { taskId: string; id: string };
    const att = await prisma.attachment.findUnique({ where: { id } });
    if (!att) return res.status(404).json({ error: "Attachment tidak ditemukan" });

    // Hanya uploader atau admin yang boleh hapus
    if (att.uploaderId !== me.id && me.role !== "ADMIN_PROJECT") {
      return res.status(403).json({ error: "Tidak punya izin menghapus" });
    }

    await prisma.attachment.delete({ where: { id } });
    const filePath = path.join(UPLOAD_DIR, att.fileName);
    fs.promises.unlink(filePath).catch(() => {});

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    await logActivity({
      type: ActivityType.ATTACHMENT_DELETED,
      actorId: me.id,
      projectId: task?.projectId ?? null,
      taskId,
      message: `${me.name} menghapus file "${att.originalName}"`,
    });

    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export { UPLOAD_DIR };
