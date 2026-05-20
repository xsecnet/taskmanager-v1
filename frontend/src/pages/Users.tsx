import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Users as UsersIcon } from "lucide-react";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { ROLE_LABEL } from "../lib/utils";
import type { Role, User } from "../types";

const ROLES: Role[] = [
  "ADMIN_PROJECT",
  "NETWORK_ENGINEER",
  "NETWORK_SECURITY_ENGINEER",
  "SYSTEM_ENGINEER",
  "SAFETY_DRIVER",
];

export function UsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/api/users")).data,
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) =>
      (await api.patch(`/api/users/${id}`, { role })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Role diupdate");
    },
    onError: () => toast.error("Gagal update role"),
  });

  const filtered = users?.filter(
    (u) =>
      !q ||
      u.name.toLowerCase().includes(q.toLowerCase()) ||
      u.email.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Manajemen User
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Atur role default tiap user. Hanya admin project yang melihat halaman ini.
          </p>
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari user…"
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar User</CardTitle>
          {users && (
            <span className="text-xs text-slate-400">{filtered?.length ?? 0} user</span>
          )}
        </CardHeader>
        <CardBody className={!filtered?.length ? "p-0" : "p-0"}>
          {isLoading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !filtered?.length ? (
            <EmptyState
              icon={<UsersIcon className="h-6 w-6" />}
              title="Tidak ada user cocok"
              description={q ? "Coba kata kunci lain." : "Belum ada user terdaftar."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-2/50">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b hairline">
                    <th className="py-2.5 px-5">Nama</th>
                    <th className="py-2.5 px-5">Email</th>
                    <th className="py-2.5 px-5">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b hairline last:border-0 hover:bg-surface-2 transition-colors"
                    >
                      <td className="py-2.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={
                              u.avatarUrl ??
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=6366f1&color=fff`
                            }
                            className="h-8 w-8 rounded-full"
                            alt=""
                          />
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {u.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-5 text-slate-600 dark:text-slate-400 text-xs">
                        {u.email}
                      </td>
                      <td className="py-2.5 px-5">
                        <Select
                          value={u.role}
                          onChange={(e) =>
                            updateRole.mutate({ id: u.id, role: e.target.value as Role })
                          }
                          className="!w-auto min-w-[200px]"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
