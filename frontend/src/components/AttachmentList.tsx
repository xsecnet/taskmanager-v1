import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { File, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { api, API_BASE } from "../lib/api";
import { Button } from "./ui/Button";
import { useToast } from "./ui/Toast";
import { formatRelative } from "../lib/utils";
import type { Attachment } from "../types";

interface Props {
  taskId: string;
  initial: Attachment[];
  currentUserId: string;
  isAdmin: boolean;
}

const API_URL = API_BASE;

export function AttachmentList({ taskId, initial, currentUserId, isAdmin }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return (
        await api.post(`/api/tasks/${taskId}/attachments`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: () => {
      toast.success("File berhasil diunggah");
      qc.invalidateQueries({ queryKey: ["task", taskId] });
    },
    onError: (err: any) => {
      toast.error("Gagal mengunggah", err?.response?.data?.error ?? "Coba file lain.");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/tasks/${taskId}/attachments/${id}`),
    onSuccess: () => {
      toast.success("File dihapus");
      qc.invalidateQueries({ queryKey: ["task", taskId] });
    },
  });

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) upload.mutate(f);
    e.target.value = "";
  }

  function isImage(mime: string) {
    return mime.startsWith("image/");
  }
  function fmtSize(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={onPick}
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
        />
        <Button
          size="sm"
          variant="subtle"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload className="h-3.5 w-3.5" />
          {upload.isPending ? "Mengunggah…" : "Upload File / Foto"}
        </Button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Maks 10MB · Gambar, PDF, Office, ZIP
        </span>
      </div>

      {initial.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed hairline p-8 text-center">
          <Upload className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Belum ada file diunggah.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {initial.map((a) => {
            const fullUrl = `${API_URL}${a.url}`;
            const canDelete = isAdmin || a.uploaderId === currentUserId;
            return (
              <li
                key={a.id}
                className="group flex flex-col rounded-xl border hairline bg-surface-1 overflow-hidden hover:shadow-elevated transition-all"
              >
                {isImage(a.mimeType) ? (
                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square overflow-hidden"
                  >
                    <img
                      src={fullUrl}
                      alt={a.originalName}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex aspect-square items-center justify-center bg-surface-2 text-slate-400"
                  >
                    <File className="h-10 w-10" />
                  </a>
                )}
                <div className="p-2.5 text-xs">
                  <div
                    className="font-medium text-slate-900 dark:text-slate-100 truncate"
                    title={a.originalName}
                  >
                    {a.originalName}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    {isImage(a.mimeType) ? (
                      <ImageIcon className="h-3 w-3" />
                    ) : (
                      <File className="h-3 w-3" />
                    )}
                    {fmtSize(a.sizeBytes)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                    {a.uploader?.name} · {formatRelative(a.createdAt)}
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => remove.mutate(a.id)}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="h-3 w-3" /> Hapus
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
