import { useCallback, useEffect, useState } from "react";
import type { Session } from "../types";
import {
  listOfflineOperations,
  offlineQueueStats,
  retryOfflineOperation,
  discardOfflineOperation,
  sessionScope,
  syncPendingOperations,
  type OfflineOperation,
} from "../db/offlineQueue";

export function useOfflineQueue(session: Session | null) {
  const scope = sessionScope(session);
  const [items, setItems] = useState<OfflineOperation[]>([]);
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const [rows, stats] = await Promise.all([
      listOfflineOperations(scope),
      offlineQueueStats(scope),
    ]);
    setItems(rows as OfflineOperation[]);
    setPending(stats.pending);
    setConflicts(stats.conflicts);
  }, [scope]);

  const syncNow = useCallback(async () => {
    if (!session || !navigator.onLine) return;
    setSyncing(true);
    try {
      await syncPendingOperations(session);
      await refresh();
    } finally {
      setSyncing(false);
    }
  }, [session, refresh]);

  useEffect(() => {
    refresh().catch(() => undefined);
    const onChange = () => refresh().catch(() => undefined);
    const onOnline = () => syncNow().catch(() => undefined);
    window.addEventListener("perez-offline-queue-changed", onChange);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("perez-offline-queue-changed", onChange);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh, syncNow]);

  useEffect(() => {
    syncNow().catch(() => undefined);
  }, [syncNow]);

  return {
    items,
    pending,
    conflicts,
    syncing,
    refresh,
    syncNow,
    retry: retryOfflineOperation,
    discard: discardOfflineOperation,
    scope,
  };
}
