import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { CalendarDays, Plus, UserPlus, Users as UsersIcon } from "lucide-react";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input, Label, Select, Textarea } from "../components/ui/Input";
import { KanbanBoard } from "../components/KanbanBoard";
import { ActivityFeed } from "../components/ActivityFeed";
import { ChatPanel } from "../components/ChatPanel";
import { SCurveChart } from "../components/SCurveChart";
import { ViewToggle } from "./Tasks";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { useMe } from "../hooks/useMe";
import {
  PRIORITY_COLOR,
  ROLE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  formatDate,
} from "../lib/utils";
import type { Project, ProjectStatus, Role, TaskPriority, TaskStatus, User } from "../types";

const ROLES: Role[] = [
  "ADMIN_PROJECT",
  "NETWORK_ENGINEER",
  "NETWORK_SECURITY_ENGINEER",
  "SYSTEM_ENGINEER",
  "SAFETY_DRIVER",
];

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const PROJECT_STATUS_TONE: Record<ProjectStatus, string> = {
  PLANNING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  ON_HOLD: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  ARCHIVED: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: me } = useMe();
  const isAdmin = me?.role === "ADMIN_PROJECT";
  const [openTask, setOpenTask] = useState(false);
  const [openMember, setOpenMember] = useState(false);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: async () => (await api.get(`/api/projects/${id}`)).data,
    enabled: Boolean(id),
  });

  if (isLoading || !project) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header card */}
      <div className="rounded-2xl border hairline bg-surface-1 p-5 sm:p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              {project.code}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                {project.description}
              </p>
            )}
          </div>
          <Badge className={PROJECT_STATUS_TONE[project.status]}>{project.status}</Badge>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border hairline bg-surface-0/60 p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Progress
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {project.progress}%
              </span>
            </div>
          </div>
          <div className="rounded-xl border hairline bg-surface-0/60 p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Owner
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
              {project.owner?.name}
            </div>
          </div>
          <div className="rounded-xl border hairline bg-surface-0/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <CalendarDays className="h-3 w-3" /> Periode
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
              {formatDate(project.startDate)} – {formatDate(project.endDate)}
            </div>
          </div>
        </div>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-slate-400" /> Anggota
            <span className="text-xs font-normal text-slate-400">
              {(project.members ?? []).length}
            </span>
          </CardTitle>
          {isAdmin && (
            <Button size="sm" variant="subtle" onClick={() => setOpenMember(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Tambah Anggota
            </Button>
          )}
        </CardHeader>
        <CardBody className={(project.members ?? []).length === 0 ? "p-0" : ""}>
          {(project.members ?? []).length === 0 ? (
            <EmptyState
              icon={<UsersIcon className="h-5 w-5" />}
              title="Belum ada anggota"
              description={isAdmin ? "Tambahkan anggota untuk mulai berkolaborasi." : ""}
            />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {project.members!.map((m) => (
                <li
                  key={m.user.id}
                  className="flex items-center gap-3 rounded-xl border hairline p-3 hover:bg-surface-2 transition-colors"
                >
                  <img
                    src={
                      m.user.avatarUrl ??
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user.name)}&background=6366f1&color=fff`
                    }
                    className="h-9 w-9 rounded-full ring-2 ring-brand-500/20"
                    alt=""
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {m.user.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {ROLE_LABEL[m.role]}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <div className="flex items-center gap-2">
            <ViewToggle view={view} onChange={setView} />
            <Button size="sm" onClick={() => setOpenTask(true)}>
              <Plus className="h-3.5 w-3.5" /> Task
            </Button>
          </div>
        </CardHeader>
        <CardBody className={(project.tasks ?? []).length === 0 ? "p-0" : ""}>
          {(project.tasks ?? []).length === 0 ? (
            <EmptyState
              icon={<Plus className="h-5 w-5" />}
              title="Belum ada task"
              description="Tambahkan task pertama untuk project ini."
              action={
                <Button onClick={() => setOpenTask(true)}>
                  <Plus className="h-4 w-4" /> Task Baru
                </Button>
              }
            />
          ) : view === "kanban" ? (
            <KanbanBoard
              tasks={project.tasks!}
              onChange={() => qc.invalidateQueries({ queryKey: ["project", id] })}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-2/50">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b hairline">
                    <th className="py-2.5 pr-3 pl-3">Task</th>
                    <th className="py-2.5 pr-3">Divisi</th>
                    <th className="py-2.5 pr-3">Prioritas</th>
                    <th className="py-2.5 pr-3">Status</th>
                    <th className="py-2.5 pr-3">Deadline</th>
                    <th className="py-2.5 pr-3">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {project.tasks!.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b hairline last:border-0 hover:bg-surface-2 transition-colors"
                    >
                      <td className="py-2.5 pr-3 pl-3">
                        <Link
                          to={`/tasks/${t.id}`}
                          className="font-medium text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400"
                        >
                          {t.title}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-400 text-xs">
                        {ROLE_LABEL[t.division]}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge className={PRIORITY_COLOR[t.priority]}>{t.priority}</Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge className={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-400 text-xs">
                        {formatDate(t.dueAt)}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-400 text-xs">
                        {t.progress}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kurva S — Rencana vs Realisasi</CardTitle>
        </CardHeader>
        <CardBody>
          <SCurveChart projectId={project.id} projectCode={project.code} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chat Tim</CardTitle>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            live
          </span>
        </CardHeader>
        <CardBody className="p-0">
          <ChatPanel projectId={project.id} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Project</CardTitle>
        </CardHeader>
        <CardBody>
          <ActivityFeed projectId={project.id} limit={20} />
        </CardBody>
      </Card>

      <NewTaskModal
        open={openTask}
        onClose={() => setOpenTask(false)}
        projectId={project.id}
      />
      <AddMemberModal
        open={openMember}
        onClose={() => setOpenMember(false)}
        projectId={project.id}
      />
    </div>
  );
}

function NewTaskModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    description: "",
    division: "NETWORK_ENGINEER" as Role,
    priority: "MEDIUM" as TaskPriority,
    status: "TODO" as TaskStatus,
    dueAt: "",
    assigneeId: "",
    weight: 1,
  });
  const { data: users } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/api/users")).data,
    enabled: open,
  });

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api/tasks", {
          ...form,
          projectId,
          weight: Number(form.weight) || 1,
          assigneeId: form.assigneeId || undefined,
          dueAt: form.dueAt || undefined,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["curve", projectId] });
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tambah Task"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Judul</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <Label>Divisi</Label>
          <Select value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Prioritas</Label>
          <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Deadline</Label>
          <Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
        </div>
        <div>
          <Label>Assignee</Label>
          <Select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
            <option value="">— Tanpa assignee —</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Bobot Kurva S</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: Number(e.target.value) || 1 })}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Default 1. Naikkan untuk task milestone (mis. 5 atau 10).
          </p>
        </div>
        <div className="col-span-2">
          <Label>Deskripsi</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

function AddMemberModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("NETWORK_ENGINEER");
  const { data: users } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/api/users")).data,
    enabled: open,
  });

  const add = useMutation({
    mutationFn: async () =>
      (await api.post(`/api/projects/${projectId}/members`, { userId, role })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      onClose();
      setUserId("");
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tambah Anggota Project"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={() => add.mutate()} disabled={!userId || add.isPending}>
            Tambahkan
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>User</Label>
          <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">— Pilih user —</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Role di Project</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </Select>
        </div>
      </div>
    </Modal>
  );
}
