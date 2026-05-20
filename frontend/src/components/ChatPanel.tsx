import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MoreHorizontal, Pin, PinOff, Send, Sparkles, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { Input, Label, Select } from "./ui/Input";
import { useMe } from "../hooks/useMe";
import {
  cn,
  formatRelative,
  ROLE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
} from "../lib/utils";
import type { ChatMessage, Role, TaskPriority, User } from "../types";

const ROLES: Role[] = [
  "ADMIN_PROJECT",
  "NETWORK_ENGINEER",
  "NETWORK_SECURITY_ENGINEER",
  "SYSTEM_ENGINEER",
  "SAFETY_DRIVER",
];
const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

interface Props {
  projectId: string;
}

export function ChatPanel({ projectId }: Props) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.role === "ADMIN_PROJECT";

  const { data: messages } = useQuery<ChatMessage[]>({
    queryKey: ["chat", projectId],
    queryFn: async () =>
      (await api.get(`/api/projects/${projectId}/messages`, { params: { limit: 100 } })).data,
    refetchInterval: 30_000,
  });

  const { data: pinned } = useQuery<ChatMessage[]>({
    queryKey: ["chat-pinned", projectId],
    queryFn: async () =>
      (await api.get(`/api/projects/${projectId}/messages/pinned`)).data,
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/api/users")).data,
    staleTime: 60_000,
  });

  useEffect(() => {
    const t = setTimeout(() => {
      api.post(`/api/projects/${projectId}/messages/read`).catch(() => {});
      qc.invalidateQueries({ queryKey: ["chat-unread", projectId] });
    }, 600);
    return () => clearTimeout(t);
  }, [messages, projectId, qc]);

  const send = useMutation({
    mutationFn: async (body: string) =>
      (await api.post(`/api/projects/${projectId}/messages`, { body })).data,
    onSuccess: (m: ChatMessage) => {
      qc.setQueryData<ChatMessage[]>(["chat", projectId], (old) =>
        old ? [...old, m] : [m]
      );
    },
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) =>
      api.post(`/api/projects/${projectId}/messages/${id}/pin`, { pinned }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-pinned", projectId] });
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      api.delete(`/api/projects/${projectId}/messages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", projectId] }),
  });

  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function onTextChange(v: string) {
    setText(v);
    const m = v.match(/(^|\s)@([\p{L}\p{N}_.\-]*)$/u);
    setMentionQuery(m ? m[2] : null);
  }

  function applyMention(u: User) {
    const handle = u.name.replace(/\s+/g, "");
    setText((t) => t.replace(/(^|\s)@([\p{L}\p{N}_.\-]*)$/u, `$1@${handle} `));
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    send.mutate(trimmed);
    setText("");
    setMentionQuery(null);
  }

  const filteredMentions = users?.filter((u) =>
    mentionQuery
      ? u.name.toLowerCase().replace(/\s+/g, "").includes(mentionQuery.toLowerCase())
      : true
  );

  const [convertOf, setConvertOf] = useState<ChatMessage | null>(null);

  return (
    <div className="flex h-[600px] flex-col">
      {pinned && pinned.length > 0 && (
        <div className="border-b hairline bg-amber-50/60 dark:bg-amber-500/10 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-1.5 font-medium mb-1">
            <Pin className="h-3 w-3" /> Pesan tersemat
          </div>
          <ul className="space-y-1">
            {pinned.slice(0, 3).map((m) => (
              <li key={m.id} className="truncate opacity-90">
                <strong>{m.author.name}:</strong> {m.body}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {!messages ? (
          <p className="text-sm text-slate-500">Memuat…</p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 mb-2">
              <Send className="h-5 w-5" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Belum ada pesan. Mulai obrolan tim di sini.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageItem
              key={m.id}
              msg={m}
              currentUserId={me?.id ?? ""}
              isAdmin={isAdmin}
              onTogglePin={() => togglePin.mutate({ id: m.id, pinned: !m.isPinned })}
              onDelete={() => remove.mutate(m.id)}
              onConvert={() => setConvertOf(m)}
            />
          ))
        )}
      </div>

      <div className="relative border-t hairline p-3 bg-surface-0/50">
        {mentionQuery !== null && filteredMentions && filteredMentions.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-2 max-h-48 overflow-y-auto rounded-xl border hairline bg-surface-1 shadow-elevated animate-fade-in">
            {filteredMentions.slice(0, 8).map((u) => (
              <button
                key={u.id}
                onClick={() => applyMention(u)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-500/10"
              >
                <img
                  src={
                    u.avatarUrl ??
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&size=24&background=6366f1&color=fff`
                  }
                  className="h-6 w-6 rounded-full"
                  alt=""
                />
                <span className="font-medium text-slate-900 dark:text-slate-100">{u.name}</span>
                <span className="text-[11px] text-slate-400">{ROLE_LABEL[u.role]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Tulis pesan… ketik @ untuk mention"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="flex-1"
          />
          <Button onClick={submit} disabled={!text.trim() || send.isPending} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ConvertToTaskModal
        msg={convertOf}
        onClose={() => setConvertOf(null)}
        users={users ?? []}
        defaultDivision={(me?.role as Role) ?? "NETWORK_ENGINEER"}
      />
    </div>
  );
}

function MessageItem({
  msg,
  currentUserId,
  isAdmin,
  onTogglePin,
  onDelete,
  onConvert,
}: {
  msg: ChatMessage;
  currentUserId: string;
  isAdmin: boolean;
  onTogglePin: () => void;
  onDelete: () => void;
  onConvert: () => void;
}) {
  const [openMenu, setOpenMenu] = useState(false);
  const canDelete = isAdmin || msg.authorId === currentUserId;

  const parts = msg.body.split(/(@[\p{L}\p{N}_.\-]+)/gu);

  return (
    <div className="flex gap-2.5 group">
      <img
        src={
          msg.author.avatarUrl ??
          `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.author.name)}&size=32&background=6366f1&color=fff`
        }
        className="h-8 w-8 rounded-full shrink-0"
        alt=""
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {msg.author.name}
          </span>
          <span className="text-[11px] text-slate-400">{formatRelative(msg.createdAt)}</span>
          {msg.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
          {parts.map((p, i) =>
            p.startsWith("@") ? (
              <span
                key={i}
                className="text-brand-700 dark:text-brand-300 font-medium bg-brand-50 dark:bg-brand-500/15 px-1 rounded"
              >
                {p}
              </span>
            ) : (
              <span key={i}>{p}</span>
            )
          )}
        </p>

        {msg.embedTask && (
          <Link
            to={`/tasks/${msg.embedTask.id}`}
            className="mt-2 block rounded-xl border hairline bg-surface-2/60 p-2.5 hover:bg-surface-2 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                  📎 {msg.embedTask.title}
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-1 rounded-full bg-gradient-to-r from-brand-500 to-brand-600"
                    style={{ width: `${msg.embedTask.progress}%` }}
                  />
                </div>
              </div>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium",
                  STATUS_COLOR[msg.embedTask.status]
                )}
              >
                {STATUS_LABEL[msg.embedTask.status]}
              </span>
            </div>
          </Link>
        )}
      </div>

      <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setOpenMenu((v) => !v)}
          onBlur={() => setTimeout(() => setOpenMenu(false), 100)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-2 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {openMenu && (
          <div className="absolute right-0 top-8 w-44 rounded-xl border hairline bg-surface-1 py-1 text-sm shadow-elevated z-10 animate-fade-in">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onConvert();
                setOpenMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-surface-2 text-left text-slate-700 dark:text-slate-300"
            >
              <Sparkles className="h-3.5 w-3.5" /> Jadikan Task
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onTogglePin();
                setOpenMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-surface-2 text-left text-slate-700 dark:text-slate-300"
            >
              {msg.isPinned ? (
                <>
                  <PinOff className="h-3.5 w-3.5" /> Lepas pin
                </>
              ) : (
                <>
                  <Pin className="h-3.5 w-3.5" /> Pin pesan
                </>
              )}
            </button>
            {canDelete && (
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  onDelete();
                  setOpenMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-left text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" /> Hapus
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConvertToTaskModal({
  msg,
  onClose,
  users,
  defaultDivision,
}: {
  msg: ChatMessage | null;
  onClose: () => void;
  users: User[];
  defaultDivision: Role;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [division, setDivision] = useState<Role>(defaultDivision);
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueAt, setDueAt] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  useEffect(() => {
    if (msg) {
      setTitle(msg.body.slice(0, 80));
      setDivision(defaultDivision);
      setPriority("MEDIUM");
      setDueAt("");
      setAssigneeId("");
    }
  }, [msg, defaultDivision]);

  const create = useMutation({
    mutationFn: async () => {
      if (!msg) return;
      return (
        await api.post("/api/tasks/from-message", {
          messageId: msg.id,
          title,
          division,
          priority,
          dueAt: dueAt || undefined,
          assigneeId: assigneeId || undefined,
        })
      ).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", msg?.projectId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["project", msg?.projectId] });
      onClose();
    },
  });

  return (
    <Modal
      open={Boolean(msg)}
      onClose={onClose}
      title="Jadikan Pesan sebagai Task"
      description="Pesan ini akan otomatis ter-link ke task baru."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending}>
            {create.isPending ? "Membuat…" : "Buat Task"}
          </Button>
        </>
      }
    >
      {msg && (
        <div className="rounded-xl border hairline bg-surface-2/50 p-3 text-xs text-slate-600 dark:text-slate-400 mb-4">
          <strong className="text-slate-900 dark:text-slate-100">{msg.author.name}:</strong> {msg.body}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Judul Task</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Divisi</Label>
          <Select value={division} onChange={(e) => setDivision(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Prioritas</Label>
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </div>
        <div>
          <Label>Deadline</Label>
          <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </div>
        <div>
          <Label>Assignee</Label>
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">— Tanpa assignee —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
        </div>
      </div>
    </Modal>
  );
}
