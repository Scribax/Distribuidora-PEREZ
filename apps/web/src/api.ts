import { useMemo } from "react";
import type { Session } from "./types";

export const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

// Convierte una respuesta de error en un objeto con `message`, tolerando cuerpos
// que no son JSON (páginas HTML de error, respuestas vacías, gateways caídos).
async function parseError(res: Response) {
  const text = await res.text().catch(() => "");
  if (text) {
    try {
      return JSON.parse(text);
    } catch {
      return { message: text.slice(0, 300) };
    }
  }
  return { message: `Error ${res.status}` };
}

export function useApi(session: Session | null, setSession: (s: Session | null) => void) {
  return useMemo(() => {
    // Deduplica refreshes concurrentes: varias requests que reciben 401 a la vez
    // comparten una única llamada a /auth/refresh en lugar de invalidarse entre sí.
    let refreshing: Promise<Session | null> | null = null;

    const doRefresh = async (): Promise<Session | null> => {
      if (!session?.refreshToken) return null;
      const refreshed = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken })
      });
      if (!refreshed.ok) return null;
      const data = await refreshed.json();
      // El endpoint puede devolver la sesión completa o solo tokens: fusionamos
      // sobre la sesión actual para no perder `user`/`refreshToken`.
      return { ...session, ...data } as Session;
    };

    return async (path: string, init: RequestInit = {}) => {
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
        refreshing ??= doRefresh();
        const next = await refreshing.finally(() => { refreshing = null; });
        if (next) {
          setSession(next);
          localStorage.setItem("perez_session", JSON.stringify(next));
          res = await run(next.accessToken);
        } else {
          setSession(null);
          localStorage.removeItem("perez_session");
        }
      }
      if (!res.ok) throw await parseError(res);
      if (res.status === 204) return null;
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/pdf") || contentType.includes("spreadsheet")) return res.blob();
      return res.json();
    };
  }, [session, setSession]);
}
