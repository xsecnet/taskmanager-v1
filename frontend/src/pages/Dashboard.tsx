import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Flame,
  FolderKanban,
  ListTodo,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { ActivityFeed } from "../components/ActivityFeed";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "../components/ui/Skeleton";
import { useMe } from "../hooks/useMe";
import { ROLE_LABEL, STATUS_COLOR, STATUS_LABEL, formatDate } from "../lib/utils";

interface DashboardData {
  totalProjects: number;
  activeProjects: number;
  tasksByStatus: { status: string; _count: { _all: number } }[];
  upcomingTasks: Array<{
    id: string;
    title: string;
    dueAt: string;
    status: string;
    project?: { id: string; name: string; code: string };
  }>;
  overdueTasks: Array<{
    id: string;
    title: string;
    dueAt: string;
    project?: { id: string; name: string; code: string };
  }>;
  myReminders: Array<{
    id: string;
    remindAt: string;
    task: { id: string; title: string };
  }>;
}

function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

export function DashboardPage() {
  const { data: me } = useMe();
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/api/dashboard")).data,
    refetchInterval: 30_000,
  });

  if (isLoading || !data || !me) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonCard />
      </div>
    );
  }

  const totalTasks = data.tasksByStatus.reduce((s, x) => s + x._count._all, 0);
  const doneTasks = data.tasksByStatus.find((s) => s.status === "DONE")?._count._all ?? 0;
  const inProgressTasks =
    data.tasksByStatus.find((s) => s.status === "IN_PROGRESS")?._count._all ?? 0;
  const todoTasks = data.tasksByStatus.find((s) => s.status === "TODO")?._count._all ?? 0;
  const overallProgress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 p-6 sm:p-8 text-white shadow-elevated">
        <div className="absolute inset-0 bg-mesh-dark opacity-50 pointer-events-none" />
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-brand-200/80">
            <Sparkles className="h-3.5 w-3.5" /> {ROLE_LABEL[me.role]}
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
            {greetingFor()}, {me.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-brand-100/80">
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            · {data.activeProjects} project aktif · {totalTasks} total task
          </p>

          <div className="mt-6 max-w-md">
            <div className="flex justify-between text-[11px] uppercase tracking-wider text-brand-200/80">
              <span>Progress keseluruhan</span>
              <span className="font-medium text-white">{overallProgress}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-white to-brand-100 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          icon={<FolderKanban className="h-4 w-4" />}
          label="Project"
          value={data.totalProjects}
          tone="brand"
        />
        <StatCard
          icon={<ListTodo className="h-4 w-4" />}
          label="Antrean"
          value={todoTasks}
          tone="slate"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Dikerjakan"
          value={inProgressTasks}
          tone="blue"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Selesai"
          value={`${doneTasks}/${totalTasks}`}
          tone="emerald"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Lewat Deadline"
          value={data.overdueTasks.length}
          tone="red"
        />
      </div>

      {/* Two-column area */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Task Mendekati Deadline</CardTitle>
              <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {data.upcomingTasks.length}
              </Badge>
            </CardHeader>
            <CardBody className={data.upcomingTasks.length === 0 ? "p-0" : ""}>
              {data.upcomingTasks.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="h-6 w-6" />}
                  title="Tidak ada deadline mendesak"
                  description="Semua task sedang on schedule. Pertahankan ritmenya."
                />
              ) : (
                <ul className="space-y-2">
                  {data.upcomingTasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-start justify-between gap-3 rounded-lg border hairline px-3 py-2.5 hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/tasks/${t.id}`}
                          className="block font-medium text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 truncate"
                        >
                          {t.title}
                        </Link>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {t.project?.code} · {t.project?.name}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {formatDate(t.dueAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {data.overdueTasks.length > 0 && (
            <Card className="border-red-200 dark:border-red-500/30 bg-red-50/40 dark:bg-red-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <Flame className="h-4 w-4" /> Task Lewat Deadline
                </CardTitle>
                <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
                  {data.overdueTasks.length}
                </Badge>
              </CardHeader>
              <CardBody>
                <ul className="space-y-1.5">
                  {data.overdueTasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <Link
                        to={`/tasks/${t.id}`}
                        className="text-slate-900 dark:text-slate-100 hover:underline truncate"
                      >
                        {t.title}
                      </Link>
                      <span className="text-red-600 dark:text-red-400 text-xs shrink-0">
                        {formatDate(t.dueAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Reminder Saya</CardTitle>
            </CardHeader>
            <CardBody>
              {data.myReminders.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="h-6 w-6" />}
                  title="Belum ada reminder"
                  description="Reminder akan otomatis dikirim ke Gmail dan Google Calendar Anda."
                />
              ) : (
                <ul className="space-y-2">
                  {data.myReminders.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start gap-3 rounded-lg p-2 hover:bg-surface-2 transition-colors"
                    >
                      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                        <CalendarClock className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/tasks/${r.task.id}`}
                          className="block text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 truncate"
                        >
                          {r.task.title}
                        </Link>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(r.remindAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Activity sidebar */}
        <Card className="self-start xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle>Aktivitas Tim</CardTitle>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              live
            </span>
          </CardHeader>
          <CardBody>
            <ActivityFeed limit={20} refetchMs={15_000} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  brand: "from-brand-500/15 to-brand-500/5 text-brand-600 dark:text-brand-300",
  slate: "from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-300",
  blue: "from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-300",
  emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-300",
  red: "from-red-500/15 to-red-500/5 text-red-600 dark:text-red-300",
};

function StatCard({
  icon,
  label,
  value,
  tone = "brand",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: keyof typeof TONES | string;
}) {
  const toneClass = TONES[tone] ?? TONES.brand;
  return (
    <div className="group rounded-xl border hairline bg-surface-1 p-4 shadow-soft hover:shadow-elevated transition-all">
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${toneClass}`}
        >
          {icon}
        </div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}
