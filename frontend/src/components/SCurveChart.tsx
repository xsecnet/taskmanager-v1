import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileSpreadsheet, Printer, TrendingDown, TrendingUp } from "lucide-react";
import { api, API_BASE } from "../lib/api";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Skeleton } from "./ui/Skeleton";

interface CurvePoint {
  date: string;
  plan: number;
  actual: number;
  deviation: number;
}

interface CurveData {
  points: CurvePoint[];
  summary: {
    today: string;
    todayPlan: number;
    todayActual: number;
    deviation: number;
    status: "AHEAD" | "ON_TRACK" | "BEHIND";
    totalWeight: number;
    taskCount: number;
  };
}

const API_URL = API_BASE;

function useDarkMode() {
  const [dark, setDark] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function SCurveChart({ projectId, projectCode }: { projectId: string; projectCode?: string }) {
  const dark = useDarkMode();
  const { data, isLoading } = useQuery<CurveData>({
    queryKey: ["curve", projectId],
    queryFn: async () => (await api.get(`/api/projects/${projectId}/curve`)).data,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const { points, summary } = data;

  const statusColor =
    summary.status === "AHEAD"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      : summary.status === "BEHIND"
      ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
      : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";

  const statusLabel =
    summary.status === "AHEAD"
      ? "Ahead of plan"
      : summary.status === "BEHIND"
      ? "Behind schedule"
      : "On track";

  const gridColor = dark ? "#334155" : "#e2e8f0";
  const textColor = dark ? "#94a3b8" : "#64748b";
  const tooltipBg = dark ? "rgba(15, 23, 42, 0.95)" : "white";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Rencana hari ini" value={`${summary.todayPlan}%`} />
        <Stat label="Realisasi hari ini" value={`${summary.todayActual}%`} />
        <Stat
          label="Deviasi"
          value={`${summary.deviation > 0 ? "+" : ""}${summary.deviation}%`}
          icon={
            summary.deviation >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            )
          }
        />
        <div className="rounded-xl border hairline bg-surface-1 p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Status
          </div>
          <div className="mt-1.5">
            <Badge className={statusColor}>{statusLabel}</Badge>
          </div>
        </div>
      </div>

      <div className="rounded-xl border hairline bg-surface-1 p-4">
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="planGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: textColor }}
                tickFormatter={(s: string) => s.slice(5)}
                minTickGap={24}
                stroke={gridColor}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: textColor }}
                tickFormatter={(v) => `${v}%`}
                stroke={gridColor}
              />
              <Tooltip
                formatter={(v: number) => `${v}%`}
                labelFormatter={(label) => `Tanggal: ${label}`}
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderRadius: 8,
                  border: `1px solid ${gridColor}`,
                  fontSize: 12,
                  color: dark ? "#f1f5f9" : "#0f172a",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: textColor }} />
              <ReferenceLine
                x={summary.today}
                stroke={dark ? "#f1f5f9" : "#0f172a"}
                strokeDasharray="4 4"
                label={{
                  value: "Hari ini",
                  fontSize: 10,
                  fill: dark ? "#f1f5f9" : "#0f172a",
                  position: "top",
                }}
              />
              <Area
                type="monotone"
                dataKey="plan"
                stroke="#94a3b8"
                fill="url(#planGrad)"
                name="Rencana"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={false}
                name="Realisasi"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <a
          href={`${API_URL}/api/projects/${projectId}/report.xlsx`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-lg border hairline bg-surface-1 px-3 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-surface-2 transition"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Export Excel
        </a>
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print / Save PDF
        </Button>
        <span className="text-xs text-slate-400 ml-auto">
          {summary.taskCount} task · total bobot {summary.totalWeight}
          {projectCode ? ` · ${projectCode}` : ""}
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border hairline bg-surface-1 p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {value}
        </span>
        {icon}
      </div>
    </div>
  );
}
