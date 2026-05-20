import { api } from "./api";

/**
 * Konversi VAPID public key (base64url) ke Uint8Array yang dipakai
 * PushManager.subscribe.
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function ensurePushSubscribed(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "No SW" };
  if (!("PushManager" in window)) return { ok: false, reason: "No PushManager" };
  if (!("Notification" in window)) return { ok: false, reason: "No Notification API" };

  // Tanya izin (prompt OS)
  if (Notification.permission === "default") {
    const p = await Notification.requestPermission();
    if (p !== "granted") return { ok: false, reason: "Permission denied" };
  } else if (Notification.permission !== "granted") {
    return { ok: false, reason: "Permission denied" };
  }

  // Ambil VAPID public key dari server
  const { data } = await api.get<{ publicKey: string; enabled: boolean }>(
    "/api/push/public-key"
  );
  if (!data.enabled || !data.publicKey) {
    return { ok: false, reason: "Server belum konfigurasi VAPID" };
  }

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }

  await api.post("/api/push/subscribe", {
    endpoint: sub.endpoint,
    keys: {
      p256dh: arrayToBase64(sub.getKey("p256dh")),
      auth: arrayToBase64(sub.getKey("auth")),
    },
    userAgent: navigator.userAgent.slice(0, 500),
  });

  return { ok: true };
}

export async function unsubscribePush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await api.post("/api/push/unsubscribe", { endpoint: sub.endpoint });
  await sub.unsubscribe();
}

function arrayToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
