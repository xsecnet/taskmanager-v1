import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, X } from "lucide-react";
import { api } from "../lib/api";
import { ensurePushSubscribed } from "../lib/push";
import { Button } from "./ui/Button";
import { useToast } from "./ui/Toast";
import { EmptyState } from "./ui/EmptyState";
import { cn, formatRelative } from "../lib/utils";
import type { Notification } from "../types";

export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => (await api.get("/api/notifications/unread-count")).data,
    refetchInterval: 60_000,
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await api.get("/api/notifications", { params: { limit: 20 } })).data,
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: async (ids?: string[]) =>
      api.post("/api/notifications/read", ids ? { ids } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const count = countData?.count ?? 0;
  const showPushPrompt =
    open && "Notification" in window && Notification.permission === "default";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-surface-2 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        title="Notifikasi"
        aria-label="Notifikasi"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-surface-1">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border hairline bg-surface-1 shadow-elevated z-40 animate-fade-in">
          <div className="flex items-center justify-between border-b hairline p-3">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Notifikasi
            </span>
            {count > 0 && (
              <button
                onClick={() => markRead.mutate(undefined)}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          {showPushPrompt && (
            <div className="border-b hairline bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-medium">Aktifkan push notification</p>
              <p className="mt-0.5 opacity-80">Supaya tidak ketinggalan info penting.</p>
              <Button
                size="sm"
                className="mt-2"
                onClick={async () => {
                  const r = await ensurePushSubscribed();
                  if (r.ok) toast.success("Push aktif", "Notifikasi akan muncul di OS Anda.");
                  else toast.error("Gagal mengaktifkan", r.reason);
                }}
              >
                Aktifkan
              </Button>
            </div>
          )}

          <div className="max-h-[420px] overflow-y-auto">
            {!notifications ? (
              <p className="p-6 text-sm text-slate-500 text-center">Memuat…</p>
            ) : notifications.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-5 w-5" />}
                title="Belum ada notifikasi"
                description="Mention, assignment, dan reminder akan muncul di sini."
              />
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      "flex gap-2 border-b hairline last:border-0 p-3 hover:bg-surface-2 cursor-pointer transition-colors",
                      !n.isRead && "bg-brand-50/50 dark:bg-brand-500/5"
                    )}
                    onClick={() => {
                      if (!n.isRead) markRead.mutate([n.id]);
                      if (n.link) {
                        setOpen(false);
                        navigate(n.link);
                      }
                    }}
                  >
                    <div
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.isRead ? "bg-transparent" : "bg-brand-500"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatRelative(n.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead.mutate([n.id]);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-surface-3 hover:text-slate-700"
                          title="Tandai dibaca"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove.mutate(n.id);
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-surface-3 hover:text-red-600"
                        title="Hapus"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
