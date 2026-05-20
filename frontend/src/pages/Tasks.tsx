import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { LayoutGrid, ListFilter, ListTodo, Table as TableIcon } from "lucide-react";
import { api } from "../lib/api";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Select } from "../components/ui/Input";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { KanbanBoard } from "../components/KanbanBoard";
import {
  PRIORITY_COLOR,
  ROLE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  cn,
  formatDate,
} from "../lib/utils";
import type { Role, Task, TaskStatus } from "../types";

const ROLES: Role[] = [
  "ADMIN_PROJECT",
  "NETWORK_ENGINEER",
  "NETWORK_SECURITY_ENGINEER",
  "SYSTEM_ENGINEER",
  "SAFETY_DRIVER",
];
const STATUSES: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "DONE",
  "CANCELLED",
];

export function TasksPage() {
  const qc = useQueryClient();
  const [division, setDivision] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [mine, setMine] = useState(false);
  const [view, setView] = useState<"kanban" | "table">("kanban");

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["tasks", { division, status, mine }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (division) params.division = division;
      if (status) params.status = status;
      if (mine) params.mine = "true";
      return (await api.get("/api/tasks", { params })).data;
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Tasks
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pekerjaan lintas project & divisi. Geser kartu untuk ubah status.
          </p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <ListFilter className="h-3.5 w-3.5" />
            Filter
          </div>
          <Select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="!w-auto min-w-[180px]"
          >
            <option value="">Semua Divisi</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="!w-auto min-w-[150px]"
          >
            <option value="">Semua Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => setMine(e.target.checked)}
              className="rounded border-slate-300"
            />
            Hanya task saya
          </label>
          {(division || status || mine) && (
            <button
              onClick={() => {
                setDivision("");
                setStatus("");
                setMine(false);
              }}
              className="ml-auto text-xs text-brand-600 dark:text-brand-400 hover:underline"
            >
              Reset filter
            </button>
          )}
        </CardBody>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : !tasks?.length ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<ListTodo className="h-6 w-6" />}
              title="Tidak ada task"
              description="Tidak ada task yang cocok dengan filter saat ini."
            />
          </CardBody>
        </Card>
      ) : view === "kanban" ? (
        <KanbanBoard
          tasks={tasks}
          onChange={() => qc.invalidateQueries({ queryKey: ["tasks"] })}
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-2/50">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b hairline">
                    <th className="py-2.5 px-4">Task</th>
                    <th className="py-2.5 px-4">Project</th>
                    <th className="py-2.5 px-4">Divisi</th>
                    <th className="py-2.5 px-4">Prioritas</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Assignee</th>
                    <th className="py-2.5 px-4">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b hairline last:border-0 hover:bg-surface-2 transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        <Link
                          to={`/tasks/${t.id}`}
                          className="font-medium text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400"
                        >
                          {t.title}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-xs">
                        {t.project?.code}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-xs">
                        {ROLE_LABEL[t.division]}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge className={PRIORITY_COLOR[t.priority]}>{t.priority}</Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge className={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-xs">
                        {t.assignee?.name ?? "—"}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-xs">
                        {formatDate(t.dueAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export function ViewToggle({
  view,
  onChange,
}: {
  view: "kanban" | "table";
  onChange: (v: "kanban" | "table") => void;
}) {
  return (
    <div className="inline-flex rounded-lg border hairline bg-surface-1 p-0.5 shadow-soft">
      <button
        onClick={() => onChange("kanban")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
          view === "kanban"
            ? "bg-brand-600 text-white shadow-soft"
            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Kanban
      </button>
      <button
        onClick={() => onChange("table")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
          view === "table"
            ? "bg-brand-600 text-white shadow-soft"
            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
        )}
      >
        <TableIcon className="h-3.5 w-3.5" /> Tabel
      </button>
    </div>
  );
}
