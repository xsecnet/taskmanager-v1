import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Sparkles, Zap } from "lucide-react";
import { useMe } from "../hooks/useMe";
import { API_BASE } from "../lib/api";

export function LoginPage() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();

  useEffect(() => {
    if (me) navigate("/");
  }, [me, navigate]);

  return (
    <div className="min-h-screen bg-surface-0 bg-mesh-light dark:bg-mesh-dark">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left — hero */}
        <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 bg-gradient-to-br from-brand-700 via-brand-800 to-slate-950 text-white">
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold tracking-tight">Task Manager</span>
            </div>
          </div>

          <div className="relative z-10 max-w-md">
            <h1 className="text-3xl font-semibold tracking-tight leading-tight">
              Kerja Tim Rapi.
              <br />
              <span className="text-brand-200">Tanpa Drama.</span>
            </h1>
            <p className="mt-4 text-sm text-brand-100/80 leading-relaxed">
              Atur jadwal, pantau progress proyek, dan kolaborasi lintas divisi
              dalam satu platform yang terhubung dengan Gmail dan Google Calendar.
            </p>
            <ul className="mt-8 space-y-2 text-sm">
              {[
                "Kanban board dengan drag & drop",
                "Reminder otomatis ke Gmail dan Calendar",
                "Kurva S rencana vs realisasi real-time",
                "Chat tim dengan mention & convert ke task",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-brand-100/90">
                  <CheckCircle2 className="h-4 w-4 text-brand-300" /> {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-10 text-xs text-brand-200/60">
            © {new Date().getFullYear()} Task Manager — Operasional Lintas Divisi
          </div>

          {/* Decorative gradient orbs */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
        </div>

        {/* Right — form */}
        <div className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-sm space-y-6 animate-fade-in">
            <div className="text-center lg:text-left">
              <div className="lg:hidden inline-flex items-center gap-2 mb-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Task Manager
                </span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Selamat datang kembali
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Masuk dengan akun Google perusahaan untuk akses jadwal dan task tim.
              </p>
            </div>

            <a
              href={`${API_BASE}/api/auth/google`}
              className="group flex w-full items-center justify-center gap-3 rounded-xl border hairline bg-surface-1 px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-surface-2 hover:shadow-elevated transition-all"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/>
                <path fill="#FBBC05" d="M5.84 14.12A6.6 6.6 0 015.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 001 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              Lanjutkan dengan Google
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>

            <div className="rounded-xl border hairline bg-brand-50/50 dark:bg-brand-500/5 p-4 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-brand-600 dark:text-brand-400 mt-0.5 shrink-0" />
                <p>
                  Dengan login, Anda mengizinkan aplikasi mengirim email reminder
                  dan membuat event di Google Calendar Anda. Aman dan dapat
                  dicabut kapan saja.
                </p>
              </div>
            </div>

            {isLoading && (
              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                Memeriksa sesi…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
