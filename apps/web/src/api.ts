import { useMemo } from "react";
import type { Session } from "./types";

export const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export function useApi(session: Session | null, setSession: (s: Session | null) => void) {
  return useMemo(() => async (path: string, init: RequestInit = {}) => {
    const run = async (token?: string) => fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers
      }
    });
    let res = await run(session?.accessToken);
    if (res.status === 401 && session?.refreshToken) {
      const refreshed = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken })
      });
      if (refreshed.ok) {
        const next = await refreshed.json();
        setSession(next);
        localStorage.setItem("perez_session", JSON.stringify(next));
        res = await run(next.accessToken);
      } else {
        setSession(null);
        localStorage.removeItem("perez_session");
      }
    }
    if (!res.ok) throw await res.json();
    if (res.status === 204) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/pdf") || contentType.includes("spreadsheet")) return res.blob();
    return res.json();
  }, [session, setSession]);
}
