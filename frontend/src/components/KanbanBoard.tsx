import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { api } from "../lib/api";
import { Badge } from "./ui/Badge";
import {
  PRIORITY_COLOR,
  ROLE_LABEL,
  STATUS_LABEL,
  cn,
  formatDateShort,
} from "../lib/utils";
import type { Task, TaskStatus } from "../types";

const COLUMNS: {
  status: TaskStatus;
  label: string;
  accent: string;
  dot: string;
}[] = [
  { status: "TODO", label: "Antrean", accent: "border-slate-300 dark:border-slate-700", dot: "bg-slate-400" },
  { status: "IN_PROGRESS", label: "Dikerjakan", accent: "border-blue-400", dot: "bg-blue-500" },
  { status: "REVIEW", label: "Review", accent: "border-amber-400", dot: "bg-amber-500" },
  { status: "BLOCKED", label: "Terhambat", accent: "border-red-400", dot: "bg-red-500" },
  { status: "DONE", label: "Selesai", accent: "border-emerald-400", dot: "bg-emerald-500" },
];

interface Props {
  tasks: Task[];
  onChange?: () => void;
}

export function KanbanBoard({ tasks, onChange }: Props) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const c of COLUMNS) map[c.status] = [];
    for (const t of tasks) {
      if (map[t.status]) map[t.status].push(t);
    }
    return map;
  }, [tasks]);

  const moveTask = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      (await api.patch(`/api/tasks/${taskId}`, { status })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onChange?.();
    },
  });

  const activeTask = tasks.find((t) => t.id === activeId);

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const taskId = String(e.active.id);
    const overStatus = e.over?.id ? (String(e.over.id) as TaskStatus) : null;
    if (!overStatus) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === overStatus) return;
    moveTask.mutate({ taskId, status: overStatus });
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory lg:snap-none">
        {COLUMNS.map((col) => (
          <Column
            key={col.status}
            status={col.status}
            label={col.label}
            accent={col.accent}
            dot={col.dot}
            tasks={grouped[col.status]}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskCard task={activeTask} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  label,
  accent,
  dot,
  tasks,
}: {
  status: TaskStatus;
  label: string;
  accent: string;
  dot: string;
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 w-[280px] snap-start rounded-xl border-t-2 bg-surface-2/50 p-3 flex flex-col gap-2 transition-colors",
        accent,
        isOver && "bg-brand-500/10 ring-2 ring-brand-400/40"
      )}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          <h3 className="text-[13px] font-semibold tracking-tight text-slate-800 dark:text-slate-200">
            {label}
          </h3>
        </div>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-surface-1 px-1.5 py-0.5 rounded-md border hairline">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
        {tasks.length === 0 && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center py-3 border border-dashed hairline rounded-lg">
            Kosong
          </p>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, dragging = false }: { task: Task; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  const overdue =
    task.dueAt && task.status !== "DONE" && new Date(task.dueAt) < new Date();

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group rounded-xl border hairline bg-surface-1 p-3 shadow-soft cursor-grab active:cursor-grabbing select-none hover:shadow-elevated transition-shadow",
        // Source card di-fade saja saat di-drag, biar tidak ikut bergeser.
        // DragOverlay yang akan tampil mengikuti kursor.
        isDragging && !dragging && "opacity-30",
        // DragOverlay clone: glow + sedikit miring biar terasa "diangkat".
        dragging && "ring-2 ring-brand-500/50 shadow-elevated rotate-1"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/tasks/${task.id}`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 line-clamp-2 leading-snug"
        >
          {task.title}
        </Link>
        <Badge className={PRIORITY_COLOR[task.priority]}>{task.priority}</Badge>
      </div>
      <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
        {ROLE_LABEL[task.division]}
      </div>
      {task.progress > 0 && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-1 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span
          className={cn(
            "inline-flex items-center gap-1",
            overdue
              ? "text-red-600 dark:text-red-400 font-medium"
              : "text-slate-500 dark:text-slate-400"
          )}
        >
          <Clock className="h-3 w-3" />
          {task.dueAt ? formatDateShort(task.dueAt) : "—"}
        </span>
        {task.assignee && (
          <img
            src={
              task.assignee.avatarUrl ??
              `https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee.name)}&size=24&background=6366f1&color=fff`
            }
            className="h-5 w-5 rounded-full ring-2 ring-surface-1"
            alt={task.assignee.name}
            title={task.assignee.name}
          />
        )}
      </div>
      <span className="sr-only">{STATUS_LABEL[task.status]}</span>
    </div>
  );
}
