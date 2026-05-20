import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatMessage, Notification } from "../types";
import { API_BASE } from "../lib/api";

const API_URL = API_BASE;

type Status = "connecting" | "open" | "closed";

interface Ctx {
  status: Status;
}

const RealtimeCtx = createContext<Ctx>({ status: "closed" });

/**
 * Buka koneksi Server-Sent Events ke /api/events. Saat backend push event,
 * kita translate jadi invalidate React Query yang relevan supaya UI update.
 *
 * Hanya dipasang setelah user terdeteksi login (di-mount oleh AppLayout).
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("connecting");
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/events`, { withCredentials: true });
    sourceRef.current = es;

    es.addEventListener("connected", () => setStatus("open"));

    es.addEventListener("notification.new", (e: MessageEvent) => {
      try {
        const notif = JSON.parse(e.data) as Notification;
        // Update list & counter
        qc.invalidateQueries({ queryKey: ["notifications"] });
        qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });

        // Toast ringan via Notification API browser kalau granted
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(notif.title, {
            body: notif.body,
            tag: notif.id,
          });
        }
      } catch {}
    });

    es.addEventListener("chat.message", (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data) as ChatMessage;
        // Update cache chat untuk project tsb
        qc.setQueryData<ChatMessage[]>(["chat", msg.projectId], (old) =>
          old ? [...old, msg] : [msg]
        );
        // Update unread count
        qc.invalidateQueries({ queryKey: ["chat-unread", msg.projectId] });
      } catch {}
    });

    es.addEventListener("chat.message.deleted", (e: MessageEvent) => {
      try {
        const { id } = JSON.parse(e.data) as { id: string };
        qc.setQueriesData<ChatMessage[]>({ queryKey: ["chat"] }, (old) =>
          old ? old.filter((m) => m.id !== id) : old
        );
      } catch {}
    });

    es.addEventListener("chat.pin", () => {
      qc.invalidateQueries({ queryKey: ["chat-pinned"] });
    });

    es.addEventListener("activity.new", () => {
      qc.invalidateQueries({ queryKey: ["activity"] });
    });

    es.addEventListener("task.updated", () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task"] });
    });

    es.onerror = () => {
      setStatus("closed");
      // EventSource akan auto-reconnect; kita biarkan
    };
    es.onopen = () => setStatus("open");

    return () => {
      es.close();
      setStatus("closed");
    };
  }, [qc]);

  return <RealtimeCtx.Provider value={{ status }}>{children}</RealtimeCtx.Provider>;
}

export function useRealtimeStatus() {
  return useContext(RealtimeCtx).status;
}
