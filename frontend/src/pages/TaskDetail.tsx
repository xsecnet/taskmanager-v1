import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { Bell, ChevronLeft, MessageSquare, Paperclip, ListChecks } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Label, Select, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { SubtaskList } from "../components/SubtaskList";
import { AttachmentList } from "../components/AttachmentList";
import { ActivityFeed } from "../components/ActivityFeed";
import { useMe } from "../hooks/useMe";
import {
  PRIORITY_COLOR,
  ROLE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  formatDate,
  formatRelative,
} from "../lib/utils";
import type {
  Attachment,
  Reminder,
  ReminderChannel,
  Subtask,
  Task,
  TaskStatus,
  TaskUpdate,
} from "../types";

const STATUSES: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "DONE",
  "CANCELLED",
];

const REMINDER_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  SENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  CANCELLED: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

interface TaskFull extends Task {
  description?: string | null;
  creator?: { id: string; name: string; email: string };
  updates: TaskUpdate[];
  reminders: Reminder[];
  subtasks: Subtask[];
  attachments: Attachment[];
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: me } = useMe();
  const [openReminder, setOpenReminder] = useState(false);

  const { data: task, isLoading } = useQuery<TaskFull>({
    queryKey: ["task", id],
    queryFn: async () => (await api.get(`/api/tasks/${id}`)).data,
    enabled: Boolean(id),
  });

  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<number | "">("");
  const [status, setStatus] = useState<TaskStatus | "">("");

  const addUpdate = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/api/tasks/${id}/updates`, {
          note,
          progress: progress === "" ? undefined : Number(progress),
          status: status || undefined,
        })
      ).data,
    onSuccess: () => {
      setNote("");
      setProgress("");
      setStatus("");
      toast.success("Update terkirim");
      qc.invalidateQueries({ queryKey: ["task", id] });
    },
    onError: () => toast.error("Gagal menyimpan update"),
  });

  if (isLoading || !task || !me) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const overdue =
    task.dueAt && task.status !== "DONE" && new Date(task.dueAt) < new Date();

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        to="/tasks"
        className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Kembali ke daftar tasks
      </Link>

      {/* Hero */}
      <div className="rounded-2xl border hairline bg-surface-1 p-5 sm:p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/projects/${task.project?.id}`}
              className="text-[11px] font-mono uppercase tracking-wider text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
            >
              {task.project?.code} · {task.project?.name}
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {task.title}
            </h1>
          </div>
          <Button variant="secondary" onClick={() => setOpenReminder(true)}>
            <Bell className="h-4 w-4" /> Tambah Reminder
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Meta label="Status">
            <Badge className={STATUS_COLOR[task.status]}>{STATUS_LABEL[task.status]}</Badge>
          </Meta>
          <Meta label="Prioritas">
            <Badge className={PRIORITY_COLOR[task.priority]}>{task.priority}</Badge>
          </Meta>
          <Meta label="Divisi">{ROLE_LABEL[task.division]}</Meta>
          <Meta label="Deadline">
            <span className={overdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
              {formatDate(task.dueAt)}
            </span>
          </Meta>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex justify-between text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Progress</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {task.progress}%
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
              style={{ width: `${task.progress}%` }}
            />
          </div>
          {task.subtasks.length > 0 && (
            <p className="mt-1.5 text-[11px] text-slate-400">
              Progress dihitung otomatis dari sub-tugas yang selesai.
            </p>
          )}
        </div>
      </div>

      {task.description && (
        <Card>
          <CardHeader>
            <CardTitle>Deskripsi</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {task.description}
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-slate-400" /> Sub-Tugas
          </CardTitle>
        </CardHeader>
        <CardBody>
          <SubtaskList taskId={task.id} initial={task.subtasks} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-slate-400" /> File & Foto Lapangan
          </CardTitle>
        </CardHeader>
        <CardBody>
          <AttachmentList
            taskId={task.id}
            initial={task.attachments}
            currentUserId={me.id}
            isAdmin={me.role === "ADMIN_PROJECT"}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update Progress</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Textarea
            placeholder="Tuliskan apa yang dikerjakan / kendala…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Progress (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) =>
                  setProgress(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={task.subtasks.length > 0}
                placeholder={
                  task.subtasks.length > 0 ? "Otomatis dari sub-tugas" : "0–100"
                }
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus | "")}
              >
                <option value="">— tidak diubah —</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button
            onClick={() => addUpdate.mutate()}
            disabled={!note || addUpdate.isPending}
          >
            {addUpdate.isPending ? "Menyimpan…" : "Kirim Update"}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-slate-400" /> Riwayat Update
          </CardTitle>
        </CardHeader>
        <CardBody>
          {task.updates.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada update.</p>
          ) : (
            <ul className="space-y-3">
              {task.updates.map((u) => (
                <li
                  key={u.id}
                  className="rounded-xl border hairline p-3.5 bg-surface-0/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={
                          u.author.avatarUrl ??
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(u.author.name)}&size=24&background=6366f1&color=fff`
                        }
                        className="h-6 w-6 rounded-full"
                        alt=""
                      />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {u.author.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {formatRelative(u.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {u.note}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {u.progress != null && (
                      <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                        progress {u.progress}%
                      </Badge>
                    )}
                    {u.status && (
                      <Badge className={STATUS_COLOR[u.status]}>{STATUS_LABEL[u.status]}</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Task</CardTitle>
        </CardHeader>
        <CardBody>
          <ActivityFeed taskId={task.id} limit={20} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
        </CardHeader>
        <CardBody>
          {task.reminders.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Belum ada reminder.
            </p>
          ) : (
            <ul className="space-y-2">
              {task.reminders.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border hairline px-3 py-2 text-sm"
                >
                  <span className="text-slate-700 dark:text-slate-300">
                    {formatDate(r.remindAt)} — {r.channel}
                  </span>
                  <Badge className={REMINDER_TONE[r.status]}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <NewReminderModal
        open={openReminder}
        onClose={() => setOpenReminder(false)}
        taskId={task.id}
      />
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border hairline bg-surface-0/60 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1.5 text-sm text-slate-900 dark:text-slate-100">{children}</div>
    </div>
  );
}

function NewReminderModal({
  open,
  onClose,
  taskId,
}: {
  open: boolean;
  onClose: () => void;
  taskId: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [remindAt, setRemindAt] = useState("");
  const [channel, setChannel] = useState<ReminderChannel>("BOTH");
  const [message, setMessage] = useState("");

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api/reminders", {
          taskId,
          remindAt,
          channel,
          message: message || undefined,
        })
      ).data,
    onSuccess: () => {
      toast.success("Reminder dijadwalkan");
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["reminders"] });
      onClose();
      setRemindAt("");
      setMessage("");
    },
    onError: () => toast.error("Gagal menyimpan reminder"),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tambah Reminder"
      description="Reminder akan dikirim via email Gmail dan/atau Google Calendar."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!remindAt || create.isPending}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Waktu Reminder</Label>
          <Input
            type="datetime-local"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
          />
        </div>
        <div>
          <Label>Channel</Label>
          <Select
            value={channel}
            onChange={(e) => setChannel(e.target.value as ReminderChannel)}
          >
            <option value="EMAIL">Email saja</option>
            <option value="CALENDAR">Google Calendar saja</option>
            <option value="BOTH">Email + Calendar</option>
          </Select>
        </div>
        <div>
          <Label>Pesan (opsional)</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tambahkan catatan untuk diri sendiri…"
          />
        </div>
      </div>
    </Modal>
  );
}
