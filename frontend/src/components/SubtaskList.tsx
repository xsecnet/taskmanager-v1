import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";
import { Input, Select } from "./ui/Input";
import { useToast } from "./ui/Toast";
import { cn, formatRelative } from "../lib/utils";
import type { Subtask, User } from "../types";

interface Props {
  taskId: string;
  initial: Subtask[];
}

export function SubtaskList({ taskId, initial }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const { data: users } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/api/users")).data,
    staleTime: 60_000,
  });

  const subtasks = initial;

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/api/tasks/${taskId}/subtasks`, {
          title,
          assigneeId: assigneeId || undefined,
        })
      ).data,
    onSuccess: () => {
      setTitle("");
      setAssigneeId("");
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => toast.error("Gagal menambah sub-tugas"),
  });

  const toggle = useMutation({
    mutationFn: async (s: Subtask) =>
      (
        await api.patch(`/api/tasks/${taskId}/subtasks/${s.id}`, {
          isDone: !s.isDone,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      api.delete(`/api/tasks/${taskId}/subtasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const updatePIC = useMutation({
    mutationFn: async ({ id, assigneeId }: { id: string; assigneeId: string | null }) =>
      (
        await api.patch(`/api/tasks/${taskId}/subtasks/${id}`, {
          assigneeId,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
    },
  });

  const done = subtasks.filter((s) => s.isDone).length;
  const pct = subtasks.length === 0 ? 0 : (done / subtasks.length) * 100;

  return (
    <div className="space-y-3">
      {subtasks.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/50 px-3 py-2">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {done}/{subtasks.length} sub-tugas selesai
          </span>
          <div className="ml-3 h-1.5 flex-1 max-w-[200px] overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {Math.round(pct)}%
          </span>
        </div>
      )}

      <ul className="space-y-1.5">
        {subtasks.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-2 rounded-lg border hairline px-3 py-2 hover:bg-surface-2 transition-colors group"
          >
            <input
              type="checkbox"
              checked={s.isDone}
              onChange={() => toggle.mutate(s)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-sm transition-colors",
                  s.isDone
                    ? "text-slate-400 line-through"
                    : "text-slate-900 dark:text-slate-100"
                )}
              >
                {s.title}
              </div>
              {s.completedAt && (
                <div className="text-[11px] text-slate-400">
                  Selesai {formatRelative(s.completedAt)}
                </div>
              )}
            </div>
            <Select
              className="!h-8 !w-40 !text-xs"
              value={s.assigneeId ?? ""}
              onChange={(e) =>
                updatePIC.mutate({
                  id: s.id,
                  assigneeId: e.target.value || null,
                })
              }
            >
              <option value="">— PIC —</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
            <button
              onClick={() => remove.mutate(s.id)}
              className="rounded-lg p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 transition"
              title="Hapus sub-tugas"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Tambah sub-tugas baru…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) create.mutate();
          }}
          className="flex-1"
        />
        <Select
          className="!w-full sm:!w-44"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
        >
          <option value="">— PIC opsional —</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </Select>
        <Button
          size="sm"
          onClick={() => create.mutate()}
          disabled={!title.trim() || create.isPending}
        >
          <Plus className="h-3.5 w-3.5" /> Tambah
        </Button>
      </div>
    </div>
  );
}
