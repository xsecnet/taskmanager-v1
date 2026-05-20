import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ROLE_LABEL: Record<string, string> = {
  ADMIN_PROJECT: "Admin Project",
  NETWORK_ENGINEER: "Network Engineer",
  NETWORK_SECURITY_ENGINEER: "Network Security Engineer",
  SYSTEM_ENGINEER: "System Engineer",
  SAFETY_DRIVER: "Safety Driver",
};

export const STATUS_LABEL: Record<string, string> = {
  TODO: "Antrean",
  IN_PROGRESS: "Dikerjakan",
  BLOCKED: "Terhambat",
  REVIEW: "Review",
  DONE: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const STATUS_COLOR: Record<string, string> = {
  TODO: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  BLOCKED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  DONE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  CANCELLED: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export const PRIORITY_COLOR: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  MEDIUM: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

export function formatDate(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

/**
 * Relative time singkat: "5m", "2j", "3h", "12 Mei".
 */
export function formatRelative(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "baru saja";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}j lalu`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}h lalu`;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}
