import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { ActivityLog } from "../types";
import { formatRelative } from "../lib/utils";
import { Skeleton } from "./ui/Skeleton";
import { EmptyState } from "./ui/EmptyState";
import { Activity } from "lucide-react";

interface Props {
  projectId?: string;
  taskId?: string;
  limit?: number;
  refetchMs?: number;
}

export function ActivityFeed({ projectId, taskId, limit = 20, refetchMs = 15_000 }: Props) {
  const { data, isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["activity", { projectId, taskId, limit }],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit };
      if (projectId) params.projectId = projectId;
      if (taskId) params.taskId = taskId;
      return (await api.get("/api/activity", { params })).data;
    },
    refetchInterval: refetchMs > 0 ? refetchMs : false,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <EmptyState
        icon={<Activity className="h-5 w-5" />}
        title="Belum ada aktivitas"
        description="Aktivitas tim akan muncul di sini secara real-time."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {data.map((a, i) => (
        <li key={a.id} className="relative flex gap-3 group">
          {i < data.length - 1 && (
            <span
              aria-hidden
              className="absolute left-[14px] top-7 h-full w-px bg-surface-3"
            />
          )}
          <img
            src={
              a.actor.avatarUrl ??
              `https://ui-avatars.com/api/?name=${encodeURIComponent(a.actor.name)}&size=32&background=6366f1&color=fff`
            }
            className="relative h-7 w-7 rounded-full shrink-0 ring-2 ring-surface-1"
            alt=""
          />
          <div className="min-w-0 flex-1 -mt-0.5">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
              {a.message}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
              <span>{formatRelative(a.createdAt)}</span>
              {a.project && (
                <Link
                  to={`/projects/${a.project.id}`}
                  className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline"
                >
                  {a.project.code}
                </Link>
              )}
              {a.task && (
                <Link
                  to={`/tasks/${a.task.id}`}
                  className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline truncate"
                >
                  {a.task.title}
                </Link>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
