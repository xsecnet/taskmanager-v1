import axios from "axios";

/**
 * Tentukan base URL backend secara dinamis:
 *   - Kalau VITE_API_URL di-set, pakai itu (override eksplisit untuk produksi).
 *   - Kalau tidak, asumsikan backend ada di host yang sama dengan frontend,
 *     port 4000. Cocok untuk akses lewat localhost atau IP LAN.
 */
function resolveBaseURL(): string {
  const env = import.meta.env.VITE_API_URL;
  if (env) return env;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return "http://localhost:4000";
}

export const api = axios.create({
  baseURL: resolveBaseURL(),
  withCredentials: true,
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && !location.pathname.startsWith("/login")) {
      location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const API_BASE = resolveBaseURL();
