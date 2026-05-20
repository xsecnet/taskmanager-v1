import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";

type Variant = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: Variant;
  duration: number;
}

interface ToastInput {
  title: string;
  description?: string;
  variant?: Variant;
  duration?: number;
}

interface Ctx {
  toast: (t: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast harus di dalam ToastProvider");
  return c;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setItems((s) => s.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID?.() ?? String(Math.random());
      const t: Toast = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "info",
        duration: input.duration ?? 4000,
      };
      setItems((s) => [...s, t]);
      if (t.duration > 0) {
        setTimeout(() => remove(id), t.duration);
      }
    },
    [remove]
  );

  const value: Ctx = {
    toast,
    success: (title, description) => toast({ title, description, variant: "success" }),
    error: (title, description) => toast({ title, description, variant: "error", duration: 6000 }),
    info: (title, description) => toast({ title, description, variant: "info" }),
    warning: (title, description) => toast({ title, description, variant: "warning" }),
  };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[100] flex flex-col items-end justify-end gap-2 p-4 sm:p-6">
        {items.map((t) => (
          <ToastCard key={t.id} t={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastCard({ t, onClose }: { t: Toast; onClose: () => void }) {
  const meta = {
    success: { Icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20" },
    error: { Icon: XCircle, color: "text-red-600 dark:text-red-400", ring: "ring-red-500/20" },
    info: { Icon: Info, color: "text-brand-600 dark:text-brand-400", ring: "ring-brand-500/20" },
    warning: { Icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/20" },
  }[t.variant];
  const Icon = meta.Icon;
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm gap-3 rounded-xl border bg-surface-1 p-4 shadow-elevated ring-1 hairline animate-slide-in-right",
        meta.ring
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", meta.color)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.title}</p>
        {t.description && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.description}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-surface-2 hover:text-slate-600 dark:hover:text-slate-200"
        aria-label="Tutup"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
