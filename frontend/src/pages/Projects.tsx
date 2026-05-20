import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Plus, Search } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Input, Label, Select, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useMe } from "../hooks/useMe";
import { useToast } from "../components/ui/Toast";
import { formatDate } from "../lib/utils";
import type { Project, ProjectStatus } from "../types";

const statuses: ProjectStatus[] = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
];

const STATUS_TONE: Record<ProjectStatus, string> = {
  PLANNING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  ON_HOLD: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  ARCHIVED: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function ProjectsPage() {
  const { data: me } = useMe();
  const isAdmin = me?.role === "ADMIN_PROJECT";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => (await api.get("/api/projects")).data,
  });

  const filtered = projects?.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.code.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Projects
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kelola seluruh project tim Anda lintas divisi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari project…"
              className="pl-9"
            />
          </div>
          {isAdmin && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Project Baru
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && filtered?.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              icon={<FolderKanban className="h-6 w-6" />}
              title={q ? "Tidak ada project cocok" : "Belum ada project"}
              description={
                q
                  ? "Coba kata kunci lain atau bersihkan filter."
                  : "Buat project pertama untuk mulai mengatur task tim."
              }
              action={
                isAdmin && !q ? (
                  <Button onClick={() => setOpen(true)}>
                    <Plus className="h-4 w-4" /> Project Baru
                  </Button>
                ) : null
              }
            />
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered?.map((p) => (
          <Link to={`/projects/${p.id}`} key={p.id} className="group">
            <Card className="h-full hover:shadow-elevated hover:-translate-y-0.5 transition-all">
              <CardBody>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      {p.code}
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {p.name}
                    </h3>
                  </div>
                  <Badge className={STATUS_TONE[p.status]}>{p.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[2.5rem]">
                  {p.description ?? "Tidak ada deskripsi."}
                </p>
                <div className="mt-4">
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Progress</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {p.progress}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {p._count?.tasks ?? 0} task · {p._count?.members ?? 0} anggota
                  </span>
                  <span>{formatDate(p.endDate)}</span>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <NewProjectModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    status: "PLANNING" as ProjectStatus,
    startDate: "",
    endDate: "",
  });

  const create = useMutation({
    mutationFn: async () => (await api.post("/api/projects", form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project dibuat", "Tambahkan anggota dan task untuk mulai.");
      onClose();
      setForm({
        name: "",
        code: "",
        description: "",
        status: "PLANNING",
        startDate: "",
        endDate: "",
      });
    },
    onError: (err: any) => {
      toast.error("Gagal menyimpan", err?.response?.data?.error ?? "Coba lagi.");
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buat Project Baru"
      description="Isi informasi dasar project. Detail bisa di-update kapan saja."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Nama Project</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Mis. Migrasi Server Kantor Pusat"
          />
        </div>
        <div>
          <Label>Kode</Label>
          <Input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="PRJ-001"
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Tanggal Mulai</Label>
          <Input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </div>
        <div>
          <Label>Tanggal Selesai</Label>
          <Input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <Label>Deskripsi</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Jelaskan tujuan dan ruang lingkup project…"
          />
        </div>
      </div>
    </Modal>
  );
}
