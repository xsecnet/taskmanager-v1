import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bell, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { formatDate } from "../lib/utils";
import type { Reminder } from "../types";

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  SENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  CANCELLED: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function RemindersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: reminders, isLoading } = useQuery<Reminder[]>({
    queryKey: ["reminders", "mine"],
    queryFn: async () =>
      (await api.get("/api/reminders", { params: { mine: "true" } })).data,
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/reminders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", "mine"] });
      toast.success("Reminder dibatalkan");
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Reminder Saya
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Daftar reminder yang dijadwalkan untuk Anda. Setiap reminder dikirim
          via email Gmail dan/atau dibuat sebagai event Google Calendar saat
          waktunya tiba.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktif</CardTitle>
        </CardHeader>
        <CardBody className={!reminders?.length ? "p-0" : ""}>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : !reminders?.length ? (
            <EmptyState
              icon={<Bell className="h-6 w-6" />}
              title="Belum ada reminder"
              description="Buka detail task untuk menambahkan reminder."
            />
          ) : (
            <ul className="space-y-2">
              {reminders.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border hairline px-4 py-3 hover:bg-surface-2 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/tasks/${r.task?.id}`}
                      className="block text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 truncate"
                    >
                      {r.task?.title ?? "Task"}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(r.remindAt)} · {r.channel}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={STATUS_TONE[r.status]}>{r.status}</Badge>
                    {r.status === "PENDING" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => cancel.mutate(r.id)}
                        title="Batalkan reminder"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
