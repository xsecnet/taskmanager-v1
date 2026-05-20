import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { ProjectsPage } from "./pages/Projects";
import { ProjectDetailPage } from "./pages/ProjectDetail";
import { TasksPage } from "./pages/Tasks";
import { TaskDetailPage } from "./pages/TaskDetail";
import { RemindersPage } from "./pages/Reminders";
import { UsersPage } from "./pages/Users";
import { AppLayout } from "./components/AppLayout";
import { useMe } from "./hooks/useMe";

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading, isError } = useMe();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        Memeriksa sesi…
      </div>
    );
  }
  if (isError || !me) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedShell><DashboardPage /></ProtectedShell>} />
      <Route path="/projects" element={<ProtectedShell><ProjectsPage /></ProtectedShell>} />
      <Route path="/projects/:id" element={<ProtectedShell><ProjectDetailPage /></ProtectedShell>} />
      <Route path="/tasks" element={<ProtectedShell><TasksPage /></ProtectedShell>} />
      <Route path="/tasks/:id" element={<ProtectedShell><TaskDetailPage /></ProtectedShell>} />
      <Route path="/reminders" element={<ProtectedShell><RemindersPage /></ProtectedShell>} />
      <Route path="/users" element={<ProtectedShell><UsersPage /></ProtectedShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
