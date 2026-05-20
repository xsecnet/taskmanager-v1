import { Router } from "express";
import ExcelJS from "exceljs";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { computeCurve } from "../services/curve";

export const reportsRouter = Router({ mergeParams: true });

reportsRouter.use(requireAuth);

async function ensureAccess(projectId: string, userId: string, role: Role) {
  if (role === Role.ADMIN_PROJECT) return true;
  const proj = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, members: { where: { userId }, select: { id: true } } },
  });
  if (!proj) return false;
  return proj.ownerId === userId || proj.members.length > 0;
}

/**
 * GET /api/projects/:projectId/curve
 */
reportsRouter.get("/curve", async (req, res, next) => {
  try {
    const me = req.user!;
    const { projectId } = req.params as { projectId: string };
    if (!(await ensureAccess(projectId, me.id, me.role))) {
      return res.status(403).json({ error: "Tidak punya akses" });
    }
    const result = await computeCurve(projectId);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/projects/:projectId/report.xlsx — laporan Excel.
 *
 * 4 sheet:
 *   1. Ringkasan
 *   2. Daftar Task
 *   3. Kurva S (data poin)
 *   4. Aktivitas
 */
reportsRouter.get("/report.xlsx", async (req, res, next) => {
  try {
    const me = req.user!;
    const { projectId } = req.params as { projectId: string };
    if (!(await ensureAccess(projectId, me.id, me.role))) {
      return res.status(403).json({ error: "Tidak punya akses" });
    }

    const [project, curve, activities] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        include: {
          owner: { select: { name: true, email: true } },
          tasks: {
            include: {
              assignee: { select: { name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      computeCurve(projectId),
      prisma.activityLog.findMany({
        where: { projectId },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    if (!project) return res.status(404).json({ error: "Project tidak ditemukan" });

    const wb = new ExcelJS.Workbook();
    wb.creator = "Task Manager";
    wb.created = new Date();

    // ---- Sheet 1: Ringkasan ----
    const s1 = wb.addWorksheet("Ringkasan");
    s1.columns = [
      { width: 28 },
      { width: 50 },
    ];
    s1.addRows([
      ["Project", project.name],
      ["Kode", project.code],
      ["Status", project.status],
      ["Owner", project.owner?.name ?? ""],
      ["Periode", `${fmt(project.startDate)} – ${fmt(project.endDate)}`],
      ["Progress", `${project.progress}%`],
      [],
      ["— Posisi Hari Ini —", ""],
      ["Tanggal", curve.summary.today],
      ["Rencana", `${curve.summary.todayPlan}%`],
      ["Realisasi", `${curve.summary.todayActual}%`],
      ["Deviasi", `${curve.summary.deviation}%`],
      [
        "Status Kurva",
        curve.summary.status === "AHEAD"
          ? "Ahead of plan"
          : curve.summary.status === "BEHIND"
          ? "Behind schedule"
          : "On track",
      ],
      ["Jumlah Task", curve.summary.taskCount.toString()],
    ]);
    s1.getColumn(1).font = { bold: true };
    s1.getRow(1).font = { bold: true, size: 14 };

    // ---- Sheet 2: Tasks ----
    const s2 = wb.addWorksheet("Tasks");
    s2.columns = [
      { header: "Kode", key: "code", width: 12 },
      { header: "Judul", key: "title", width: 40 },
      { header: "Divisi", key: "division", width: 28 },
      { header: "Status", key: "status", width: 14 },
      { header: "Prioritas", key: "priority", width: 12 },
      { header: "Bobot", key: "weight", width: 8 },
      { header: "Progress", key: "progress", width: 10 },
      { header: "Mulai", key: "start", width: 14 },
      { header: "Deadline", key: "due", width: 14 },
      { header: "Selesai", key: "done", width: 18 },
      { header: "Assignee", key: "assignee", width: 22 },
    ];
    s2.getRow(1).font = { bold: true };
    s2.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    project.tasks.forEach((t, i) => {
      s2.addRow({
        code: `T-${(i + 1).toString().padStart(3, "0")}`,
        title: t.title,
        division: t.division,
        status: t.status,
        priority: t.priority,
        weight: t.weight,
        progress: `${t.progress}%`,
        start: fmt(t.startAt),
        due: fmt(t.dueAt),
        done: fmt(t.completedAt),
        assignee: t.assignee?.name ?? "—",
      });
    });

    // ---- Sheet 3: Kurva S ----
    const s3 = wb.addWorksheet("Kurva S");
    s3.columns = [
      { header: "Tanggal", key: "date", width: 14 },
      { header: "Rencana (%)", key: "plan", width: 14 },
      { header: "Realisasi (%)", key: "actual", width: 14 },
      { header: "Deviasi (%)", key: "deviation", width: 14 },
    ];
    s3.getRow(1).font = { bold: true };
    s3.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    curve.points.forEach((p) => s3.addRow(p));

    // ---- Sheet 4: Aktivitas ----
    const s4 = wb.addWorksheet("Aktivitas");
    s4.columns = [
      { header: "Waktu", key: "createdAt", width: 22 },
      { header: "Tipe", key: "type", width: 22 },
      { header: "Aktor", key: "actor", width: 22 },
      { header: "Pesan", key: "message", width: 80 },
    ];
    s4.getRow(1).font = { bold: true };
    s4.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    activities.forEach((a) =>
      s4.addRow({
        createdAt: a.createdAt.toLocaleString("id-ID"),
        type: a.type,
        actor: a.actor.name,
        message: a.message,
      })
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${project.code}-report-${curve.summary.today}.xlsx"`
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    next(e);
  }
});

function fmt(d?: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}
