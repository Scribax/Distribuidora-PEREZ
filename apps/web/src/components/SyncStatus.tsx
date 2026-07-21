import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useOnline } from "../hooks/useOnline";

type SyncInfo = {
  pending: number;
  conflicts: number;
  syncing: boolean;
  onSync?: () => void;
};

export function SyncStatus({ pending = 0, conflicts = 0, syncing = false, onSync }: Partial<SyncInfo>) {
  const online = useOnline();
  if (online && pending === 0 && conflicts === 0) return null;

  const bg = conflicts > 0 ? "#b45309" : online ? "#065f46" : "#dc2626";
  const text = conflicts > 0
    ? `${conflicts} cambio${conflicts === 1 ? "" : "s"} con conflicto para revisar`
    : pending > 0
      ? online
        ? `${pending} cambio${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"} de sincronizar`
        : `${pending} cambio${pending === 1 ? "" : "s"} guardado${pending === 1 ? "" : "s"} en este equipo`
      : "Sin conexión — los datos mostrados son locales";

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: bg, color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 16px", fontSize: 14, fontWeight: 600 }}>
      {online ? <Wifi size={18} /> : <WifiOff size={18} />}
      <span>{syncing ? "Sincronizando cambios pendientes..." : text}</span>
      {online && pending > 0 && onSync && (
        <button type="button" onClick={onSync} style={{ border: "1px solid rgba(255,255,255,.55)", background: "rgba(255,255,255,.14)", color: "white", borderRadius: 999, padding: "4px 10px", fontWeight: 800, cursor: "pointer" }}>
          <RefreshCw size={14} /> Sincronizar
        </button>
      )}
    </div>
  );
}

export function OnlinePill({ pending = 0, conflicts = 0, syncing = false }: Partial<SyncInfo>) {
  const online = useOnline();
  const status = conflicts > 0 ? "Conflictos" : syncing ? "Sync..." : pending > 0 ? `${pending} pendiente${pending === 1 ? "" : "s"}` : online ? "En línea" : "Offline";
  const bg = conflicts > 0 ? "#b45309" : pending > 0 ? "#92400e" : online ? "#065f46" : "#991b1b";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "2px 8px", borderRadius: 999, background: bg, color: "#fff" }} title={status}>
      {online ? <Wifi size={12} /> : <WifiOff size={12} />}
      {status}
    </span>
  );
}
