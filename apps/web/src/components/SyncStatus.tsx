import { Wifi, WifiOff } from "lucide-react";
import { useOnline } from "../hooks/useOnline";

/** Indicador de conectividad que se muestra fijo en la esquina inferior. */
export function SyncStatus() {
  const online = useOnline();

  if (online) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#dc2626",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "8px 16px",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      <WifiOff size={18} />
      Sin conexión — los datos mostrados son locales
    </div>
  );
}

/** Versión compacta para usar en la navbar (escritorio). */
export function OnlinePill() {
  const online = useOnline();

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        background: online ? "#065f46" : "#991b1b",
        color: "#fff",
      }}
      title={online ? "Conectado" : "Sin conexión"}
    >
      {online ? <Wifi size={12} /> : <WifiOff size={12} />}
      {online ? "En línea" : "Offline"}
    </span>
  );
}
