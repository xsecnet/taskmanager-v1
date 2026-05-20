import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { User } from "../types";

export function useMe() {
  return useQuery<User>({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/api/auth/me")).data,
    retry: false,
    staleTime: 60_000,
  });
}
