import type { Response } from "express";

/**
 * Event bus + SSE registry sederhana.
 *
 * Setiap user yang aktif buka aplikasi punya 1+ koneksi SSE (multi-tab).
 * Saat backend perlu push event ke user, panggil `pushTo(userId, event)`.
 *
 * Untuk multi-instance backend, ganti ini dengan Redis pub/sub.
 * Sekarang single-instance, in-memory cukup.
 */

export interface RealtimeEvent {
  type:
    | "chat.message"
    | "chat.message.deleted"
    | "chat.pin"
    | "notification.new"
    | "task.updated"
    | "activity.new";
  payload: unknown;
}

type Client = {
  userId: string;
  res: Response;
};

const clients = new Set<Client>();

export function registerClient(userId: string, res: Response) {
  const client: Client = { userId, res };
  clients.add(client);

  res.on("close", () => clients.delete(client));
  res.on("error", () => clients.delete(client));

  // initial event "connected" supaya client tahu stream hidup
  send(res, { type: "connected", payload: { userId, ts: Date.now() } });

  // heartbeat tiap 25s untuk cegah proxy timeout
  const beat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clearInterval(beat);
    }
  }, 25_000);
  res.on("close", () => clearInterval(beat));

  return client;
}

function send(res: Response, evt: { type: string; payload: unknown }) {
  try {
    res.write(`event: ${evt.type}\n`);
    res.write(`data: ${JSON.stringify(evt.payload)}\n\n`);
  } catch {
    // ignore broken pipe
  }
}

/** Push event ke 1 user (semua koneksi). */
export function pushTo(userId: string, evt: RealtimeEvent) {
  for (const c of clients) {
    if (c.userId === userId) send(c.res, evt);
  }
}

/** Push event ke banyak user. */
export function pushToMany(userIds: string[], evt: RealtimeEvent) {
  const set = new Set(userIds);
  for (const c of clients) {
    if (set.has(c.userId)) send(c.res, evt);
  }
}

/** Broadcast ke semua user yang sedang konek (jarang dipakai). */
export function broadcast(evt: RealtimeEvent) {
  for (const c of clients) send(c.res, evt);
}
