import { ActivityType } from "@prisma/client";
import { prisma } from "../lib/prisma";

interface LogParams {
  type: ActivityType;
  actorId: string;
  projectId?: string | null;
  taskId?: string | null;
  message: string;
  meta?: Record<string, unknown>;
}

/**
 * Catat aktivitas. Selalu fire-and-forget, tidak boleh meledakkan
 * request user kalau gagal.
 */
export async function logActivity(params: LogParams) {
  try {
    await prisma.activityLog.create({
      data: {
        type: params.type,
        actorId: params.actorId,
        projectId: params.projectId ?? null,
        taskId: params.taskId ?? null,
        message: params.message,
        meta: params.meta ? (params.meta as any) : undefined,
      },
    });
  } catch (err) {
    console.error("[activity] gagal mencatat", err);
  }
}
