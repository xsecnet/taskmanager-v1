import { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { pushTo } from "../lib/realtime";
import { sendWebPush, isPushConfigured } from "../lib/push";

interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  meta?: Record<string, unknown>;
}

/**
 * Buat notifikasi in-app, push via SSE ke browser, dan kirim Web Push
 * ke semua subscription user (kalau VAPID di-set). Fire-and-forget.
 */
export async function notify(params: NotifyParams) {
  try {
    const notif = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
        meta: params.meta ? (params.meta as any) : undefined,
      },
    });

    // SSE → bell di-update tanpa refresh
    pushTo(params.userId, { type: "notification.new", payload: notif });

    // Web Push (background notification ke device)
    if (isPushConfigured()) {
      const subs = await prisma.pushSubscription.findMany({
        where: { userId: params.userId },
      });
      for (const s of subs) {
        const res = await sendWebPush(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          {
            title: params.title,
            body: params.body,
            url: params.link ?? "/",
            tag: notif.id,
          }
        );
        if (!res.ok) {
          // 404/410 → subscription expired, hapus dari DB
          if (res.statusCode === 404 || res.statusCode === 410) {
            await prisma.pushSubscription
              .delete({ where: { id: s.id } })
              .catch(() => {});
          } else {
            console.warn("[notify] push gagal:", res.statusCode, res.error);
          }
        } else {
          await prisma.pushSubscription
            .update({
              where: { id: s.id },
              data: { lastUsedAt: new Date() },
            })
            .catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error("[notify] error", err);
  }
}
