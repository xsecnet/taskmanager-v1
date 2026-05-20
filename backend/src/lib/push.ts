import webpush from "web-push";

const PUBLIC = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

let configured = false;

export function getVapidPublicKey() {
  return PUBLIC ?? "";
}

export function isPushConfigured() {
  return Boolean(PUBLIC && PRIVATE);
}

if (PUBLIC && PRIVATE) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    configured = true;
  } catch (err) {
    console.warn("[push] gagal konfigurasi VAPID:", (err as Error).message);
  }
} else {
  console.warn(
    "[push] VAPID keys belum di-set di .env, push notification akan dilewati. " +
      "Generate dengan: npx web-push generate-vapid-keys"
  );
}

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendWebPush(
  sub: WebPushSubscription,
  payload: PushPayload
): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  if (!configured) return { ok: false, error: "Push tidak terkonfigurasi" };
  try {
    const res = await webpush.sendNotification(sub, JSON.stringify(payload));
    return { ok: true, statusCode: res.statusCode };
  } catch (err: any) {
    return { ok: false, statusCode: err.statusCode, error: err.body ?? err.message };
  }
}
