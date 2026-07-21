import type { Session } from "../types";
import { db } from "./index";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export type OfflineOperationStatus = "pending" | "syncing" | "synced" | "conflict";

export interface OfflineOperation {
  id: string;
  type: "CREATE_REMITO";
  method: "POST";
  path: string;
  body: any;
  preview?: any;
  scope: string;
  status: OfflineOperationStatus;
  attempts: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
}

export function sessionScope(session: Session | null) {
  return session?.user ? `${session.user.id}:${session.user.rol}` : "anonymous";
}

function queueChanged() {
  window.dispatchEvent(new CustomEvent("perez-offline-queue-changed"));
}

export async function enqueuePendingRemito(body: any, preview: any, scope: string) {
  const now = Date.now();
  const operation: OfflineOperation = {
    id: crypto.randomUUID(),
    type: "CREATE_REMITO",
    method: "POST",
    path: "/remitos",
    body,
    preview,
    scope,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.offlineOperations.add(operation);
  queueChanged();
  return operation;
}

export async function listOfflineOperations(scope: string, statuses: OfflineOperationStatus[] = ["pending", "syncing", "conflict"]) {
  const rows = await db.offlineOperations.where("scope").equals(scope).toArray();
  return rows
    .filter((row) => statuses.includes(row.status as OfflineOperationStatus))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function offlineQueueStats(scope: string) {
  const rows = await listOfflineOperations(scope);
  return {
    pending: rows.filter((row) => row.status === "pending" || row.status === "syncing").length,
    conflicts: rows.filter((row) => row.status === "conflict").length,
  };
}

async function parseSyncError(res: Response) {
  const text = await res.text().catch(() => "");
  if (!text) return `Error ${res.status}`;
  try {
    const parsed = JSON.parse(text);
    return parsed.message ?? parsed.code ?? text.slice(0, 240);
  } catch {
    return text.slice(0, 240);
  }
}

export async function syncPendingOperations(session: Session | null) {
  if (!session || !navigator.onLine) return { synced: 0, conflicts: 0 };
  const scope = sessionScope(session);
  const rows = await listOfflineOperations(scope, ["pending"]);
  let synced = 0;
  let conflicts = 0;

  for (const row of rows) {
    await db.offlineOperations.update(row.id, {
      status: "syncing",
      attempts: row.attempts + 1,
      updatedAt: Date.now(),
      error: undefined,
    });
    queueChanged();

    try {
      const res = await fetch(`${API_BASE}${row.path}`, {
        method: row.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(row.body),
      });

      if (res.ok) {
        await db.offlineOperations.update(row.id, {
          status: "synced",
          syncedAt: Date.now(),
          updatedAt: Date.now(),
        });
        synced += 1;
      } else {
        const error = await parseSyncError(res);
        await db.offlineOperations.update(row.id, {
          status: "conflict",
          error,
          updatedAt: Date.now(),
        });
        conflicts += 1;
      }
    } catch {
      await db.offlineOperations.update(row.id, {
        status: "pending",
        error: "Sin conexión. Se reintentará automáticamente.",
        updatedAt: Date.now(),
      });
      break;
    } finally {
      queueChanged();
    }
  }

  return { synced, conflicts };
}

export async function retryOfflineOperation(id: string) {
  await db.offlineOperations.update(id, { status: "pending", error: undefined, updatedAt: Date.now() });
  queueChanged();
}

export async function discardOfflineOperation(id: string) {
  await db.offlineOperations.delete(id);
  queueChanged();
}
