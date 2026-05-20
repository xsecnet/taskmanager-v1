import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useMe } from "../hooks/useMe";
import { useTheme } from "../hooks/useTheme";
import { api } from "../lib/api";
import { ROLE_LABEL, cn } from "../lib/utils";
import { RealtimeProvider } from "./RealtimeProvider";
import { NotificationBell } from "./NotificationBell";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/reminders", label: "Reminders", icon: Bell },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toggle } = useTheme();
  const [isDark, setIsDark] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  const isAdmin = me?.role === "ADMIN_PROJECT";

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Sync state ikon theme toggle
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  async function logout() {
    await api.post("/api/auth/logout");
    navigate("/login");
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="flex items-center justify-between p-5 border-b hairline">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              Task Manager
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Lintas Divisi</p>
          </div>
        </Link>
        <button
          className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-2 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-label="Tutup menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700 font-medium dark:bg-brand-500/15 dark:text-brand-300"
                  : "text-slate-600 dark:text-slate-300 hover:bg-surface-2 hover:text-slate-900 dark:hover:text-slate-100"
              )
            }
          >
            <it.icon className="h-4 w-4" /> {it.label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/users"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700 font-medium dark:bg-brand-500/15 dark:text-brand-300"
                  : "text-slate-600 dark:text-slate-300 hover:bg-surface-2 hover:text-slate-900 dark:hover:text-slate-100"
              )
            }
          >
            <Users className="h-4 w-4" /> Users
          </NavLink>
        )}
      </nav>
      <div className="p-3 border-t hairline">
        {me && (
          <div className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-surface-2 transition-colors">
            <img
              src={
                me.avatarUrl ??
                `https://ui-avatars.com/api/?name=${encodeURIComponent(me.name)}&background=6366f1&color=fff`
              }
              className="h-9 w-9 rounded-full ring-2 ring-brand-500/20"
              alt=""
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {me.name}
              </div>
              <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {ROLE_LABEL[me.role]}
              </div>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-3 hover:text-red-600"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <RealtimeProvider>
      <div className="flex h-screen overflow-hidden bg-surface-0">
        {/* Sidebar desktop */}
        <aside className="hidden w-64 shrink-0 border-r hairline lg:flex">
          {sidebar}
        </aside>

        {/* Drawer mobile */}
        {drawerOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden animate-fade-in"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden animate-slide-in-right shadow-elevated">
              {sidebar}
            </aside>
          </>
        )}

        <main className="flex-1 overflow-auto">
          {/* Topbar */}
          <div className="sticky top-0 z-30 flex items-center gap-2 border-b hairline glass px-4 py-2.5 sm:px-6">
            <button
              className="rounded-lg p-2 text-slate-500 hover:bg-surface-2 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Buka menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex-1" />

            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-slate-500 hover:bg-surface-2 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              title={isDark ? "Light mode" : "Dark mode"}
              aria-label="Toggle tema"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <NotificationBell />
          </div>

          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </RealtimeProvider>
  );
}
