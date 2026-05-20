import { Project, Task, TaskUpdate } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface CurvePoint {
  date: string; // ISO yyyy-mm-dd
  plan: number; // % cumulative 0-100
  actual: number; // % cumulative 0-100
  deviation: number; // actual - plan, bisa negatif
}

export interface CurveResult {
  points: CurvePoint[];
  summary: {
    today: string;
    todayPlan: number;
    todayActual: number;
    deviation: number; // %, positif = ahead, negatif = lag
    status: "AHEAD" | "ON_TRACK" | "BEHIND";
    totalWeight: number;
    taskCount: number;
  };
}

const DAY = 1000 * 60 * 60 * 24;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Linear plan: progress = (D - start) / (end - start), clamp 0..1.
 */
function plannedProgress(start: Date, end: Date, at: Date): number {
  const s = start.getTime();
  const e = end.getTime();
  const t = at.getTime();
  if (e <= s) return t >= e ? 1 : 0;
  const r = (t - s) / (e - s);
  return Math.max(0, Math.min(1, r));
}

/**
 * Actual progress task pada tanggal `at`, berdasarkan riwayat update.
 * Algoritma: cari TaskUpdate terakhir dengan createdAt <= at yang punya
 * field `progress`, fallback ke 0. Kalau task sudah completedAt <= at,
 * progress = 100. Kalau at >= sekarang, pakai task.progress saat ini.
 */
function actualProgressAt(
  task: Task & { updates: TaskUpdate[] },
  at: Date,
  now: Date
): number {
  if (task.completedAt && task.completedAt.getTime() <= at.getTime()) return 100;
  if (at.getTime() >= now.getTime()) return task.progress;

  // ambil update terakhir dengan progress != null sebelum at
  const sorted = task.updates
    .filter((u) => u.progress != null && u.createdAt.getTime() <= at.getTime())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (sorted.length > 0) return sorted[0].progress as number;
  return 0;
}

/**
 * Hitung kurva S kumulatif untuk satu project.
 *
 * Sampling: jumlah titik = min(durasi proyek dalam hari, 60). Minimal 10 titik.
 */
export async function computeCurve(projectId: string): Promise<CurveResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: {
        where: { status: { not: "CANCELLED" } },
        include: { updates: true },
      },
    },
  });

  if (!project) {
    throw new Error("Project tidak ditemukan");
  }

  const tasks = project.tasks;
  const now = startOfDay(new Date());

  // Tentukan window project
  const taskStartCandidates: number[] = [];
  const taskEndCandidates: number[] = [];
  for (const t of tasks) {
    const s = t.startAt ?? t.createdAt;
    const e = t.dueAt ?? project.endDate ?? null;
    if (s) taskStartCandidates.push(s.getTime());
    if (e) taskEndCandidates.push(e.getTime());
  }

  const projectStart = startOfDay(
    project.startDate ??
      new Date(Math.min(...(taskStartCandidates.length ? taskStartCandidates : [now.getTime()])))
  );
  const projectEnd = startOfDay(
    project.endDate ??
      new Date(
        Math.max(
          ...(taskEndCandidates.length
            ? taskEndCandidates
            : [now.getTime() + 30 * DAY])
        )
      )
  );

  const totalWeight = tasks.reduce((s, t) => s + t.weight, 0);

  // Buat 30 titik sampling antara projectStart dan max(projectEnd, today)
  const lastDate = projectEnd.getTime() > now.getTime() ? projectEnd : now;
  const totalDays = Math.max(
    10,
    Math.min(60, Math.ceil((lastDate.getTime() - projectStart.getTime()) / DAY))
  );
  const stepMs = (lastDate.getTime() - projectStart.getTime()) / totalDays;

  const points: CurvePoint[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const at = startOfDay(new Date(projectStart.getTime() + stepMs * i));
    let planSum = 0;
    let actualSum = 0;
    for (const t of tasks) {
      const tStart = startOfDay(t.startAt ?? project.startDate ?? t.createdAt);
      const tEnd = startOfDay(t.dueAt ?? projectEnd);
      const planP = plannedProgress(tStart, tEnd, at);
      planSum += t.weight * planP;
      const actP = actualProgressAt(t, at, now) / 100;
      actualSum += t.weight * actP;
    }
    const plan = totalWeight ? Math.round((planSum / totalWeight) * 1000) / 10 : 0;
    const actual = totalWeight ? Math.round((actualSum / totalWeight) * 1000) / 10 : 0;
    points.push({
      date: fmt(at),
      plan,
      actual,
      deviation: Math.round((actual - plan) * 10) / 10,
    });
  }

  // Ringkasan posisi hari ini
  let planNow = 0;
  let actualNow = 0;
  for (const t of tasks) {
    const tStart = startOfDay(t.startAt ?? project.startDate ?? t.createdAt);
    const tEnd = startOfDay(t.dueAt ?? projectEnd);
    planNow += t.weight * plannedProgress(tStart, tEnd, now);
    actualNow += t.weight * (actualProgressAt(t, now, now) / 100);
  }
  const todayPlan = totalWeight ? Math.round((planNow / totalWeight) * 1000) / 10 : 0;
  const todayActual = totalWeight ? Math.round((actualNow / totalWeight) * 1000) / 10 : 0;
  const dev = Math.round((todayActual - todayPlan) * 10) / 10;
  const status: "AHEAD" | "ON_TRACK" | "BEHIND" =
    dev >= 5 ? "AHEAD" : dev <= -5 ? "BEHIND" : "ON_TRACK";

  return {
    points,
    summary: {
      today: fmt(now),
      todayPlan,
      todayActual,
      deviation: dev,
      status,
      totalWeight,
      taskCount: tasks.length,
    },
  };
}
