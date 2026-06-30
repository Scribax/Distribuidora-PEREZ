import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";

export function ReportsView({ api }: { api: ReturnType<typeof useApi> }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [auditUsers, setAuditUsers] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilters, setAuditFilters] = useState({ modulo: "", accion: "", usuarioId: "", fechaDesde: "", fechaHasta: "" });
  const auditPageSize = 12;
  const loadAudit = (next = auditFilters, page = auditPage) => api(`/informes/auditoria?${qs({ ...next, page, pageSize: auditPageSize })}`).then((data) => {
    setAuditRows(data.items);
    setAuditUsers(data.users ?? auditUsers);
    setAuditTotal(data.total ?? data.items.length);
    setAuditPage(data.page ?? page);
  });
  useEffect(() => { loadAudit(auditFilters, 1); }, []);
  async function download(kind: string, format: "pdf" | "xlsx") {
    const blob = await api(`/informes/${kind}?${qs({ year, month, format })}`, { headers: { Accept: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}.${format}`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  const reportRows = [
    ["clientes", "Clientes con saldos"],
    ["ventas", "Ventas del período"],
    ["compras", "Compras del período"],
    ["gastos", "Gastos del período"],
    ["productos", "Productos y stock"]
  ];
  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / auditPageSize));
  const firstAudit = auditTotal === 0 ? 0 : (auditPage - 1) * auditPageSize + 1;
  const lastAudit = Math.min(auditPage * auditPageSize, auditTotal);
  const goAuditPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), auditTotalPages);
    setAuditPage(safePage);
    loadAudit(auditFilters, safePage);
  };
  return <div className="reports-page">
    <section className="panel wide">
      <h2>Informes</h2>
      <div className="filters">
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2026, i, 1).toLocaleString("es-AR", { month: "long" })}</option>)}</select>
      </div>
      <div className="report-list">{reportRows.map(([kind, label]) => <div className="report-row" key={kind}><strong>{label}</strong><div className="table-actions"><button type="button" className="secondary" onClick={() => download(kind, "pdf")}>PDF</button><button type="button" className="secondary" onClick={() => download(kind, "xlsx")}>Excel</button></div></div>)}</div>
    </section>
    <section className="panel wide audit-panel">
      <div className="detail-head"><div><h2>Actividad del sistema</h2><span>Cada alta, edición, anulación, eliminación o cambio sensible hecho dentro de la página.</span></div></div>
      <form className="filters audit-filters" onSubmit={(event) => { event.preventDefault(); setAuditPage(1); loadAudit(auditFilters, 1); }}>
        <select value={auditFilters.modulo} onChange={(event) => setAuditFilters({ ...auditFilters, modulo: event.target.value })}><option value="">Todos los módulos</option>{["Clientes", "Ventas", "Productos", "Stock", "Compras", "Gastos", "Usuarios", "Comerciales"].map((item) => <option value={item} key={item}>{item}</option>)}</select>
        <select value={auditFilters.accion} onChange={(event) => setAuditFilters({ ...auditFilters, accion: event.target.value })}><option value="">Todas las acciones</option>{["CREAR", "EDITAR", "ELIMINAR", "DESACTIVAR", "CANCELAR", "ANULAR", "AJUSTAR_STOCK", "AUMENTAR_PRECIOS"].map((item) => <option value={item} key={item}>{auditActionLabel(item)}</option>)}</select>
        <select value={auditFilters.usuarioId} onChange={(event) => setAuditFilters({ ...auditFilters, usuarioId: event.target.value })}><option value="">Todos los usuarios</option>{auditUsers.map((user) => <option value={user.id} key={user.id}>{user.nombre}</option>)}</select>
        <input type="date" value={auditFilters.fechaDesde} onChange={(event) => setAuditFilters({ ...auditFilters, fechaDesde: event.target.value })} />
        <input type="date" value={auditFilters.fechaHasta} onChange={(event) => setAuditFilters({ ...auditFilters, fechaHasta: event.target.value })} />
        <button>Filtrar</button>
      </form>
      <div className="audit-toolbar">
        <span>{firstAudit}-{lastAudit} de {auditTotal} movimientos</span>
        <div className="pager compact-pager">
          <button type="button" className="secondary" onClick={() => goAuditPage(auditPage - 1)} disabled={auditPage === 1}>Anterior</button>
          <span>Página {auditPage} de {auditTotalPages}</span>
          <button type="button" className="secondary" onClick={() => goAuditPage(auditPage + 1)} disabled={auditPage === auditTotalPages}>Siguiente</button>
        </div>
      </div>
      <div className="audit-list">{auditRows.map((row) => <AuditRow row={row} key={row.id} />)}{!auditRows.length && <p className="muted">No hay movimientos con estos filtros.</p>}</div>
    </section>
  </div>;
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = { CREAR: "Creó", EDITAR: "Editó", ELIMINAR: "Eliminó", DESACTIVAR: "Desactivó", CANCELAR: "Canceló", ANULAR: "Anuló", AJUSTAR_STOCK: "Ajustó stock", AUMENTAR_PRECIOS: "Aumentó precios" };
  return labels[action] ?? action;
}

function formatAuditDate(value: string) {
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function AuditRow({ row }: { row: any }) {
  const [open, setOpen] = useState(false);
  const changes = auditChangeRows(row.cambios);
  return <article className="audit-row">
    <button type="button" className="audit-main" onClick={() => setOpen(!open)}>
      <div><strong>{row.descripcion}</strong><span>{row.usuario?.nombre ?? "Usuario"} · {formatAuditDate(row.createdAt)}</span></div>
      <div className="audit-tags"><span className="status-chip activo">{row.modulo}</span><span className="status-chip parcial">{auditActionLabel(row.accion)}</span></div>
    </button>
    {open && <div className="audit-changes">{changes.length ? changes.map((change) => <div key={change.key}><strong>{change.label}</strong><span>{change.value}</span></div>) : <p className="muted">Sin detalle adicional.</p>}</div>}
  </article>;
}

function auditChangeRows(changes: any) {
  if (!changes || typeof changes !== "object") return [];
  return Object.entries(changes)
    .filter(([key, value]) => value !== null && !hiddenAuditKeys.has(key))
    .map(([key, value]) => ({ key, label: auditFieldLabel(key), value: formatAuditChange(key, value) }))
    .filter((row) => row.value !== "");
}

const hiddenAuditKeys = new Set(["antes", "despues", "cliente", "items", "remitos"]);

function auditFieldLabel(key: string) {
  const labels: Record<string, string> = {
    activo: "Estado",
    backupPath: "Backup",
    boletasEliminadas: "Boletas eliminadas",
    costo: "Costo",
    deudaRestada: "Saldo descontado",
    email: "Email",
    empresa: "Empresa",
    estado: "Estado",
    metodoPago: "Método de pago",
    montoPagado: "Monto pagado",
    nombre: "Nombre",
    observaciones: "Observaciones",
    pagoEstado: "Estado de cobro",
    precioMayorista: "Precio mayorista",
    precioMinorista: "Precio minorista",
    porcentajeComision: "Comisión",
    saldoPendiente: "Saldo pendiente",
    stockActual: "Stock",
    telefono: "Telefono",
    total: "Total",
    vendedorId: "Vendedor"
  };
  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function formatAuditChange(key: string, value: any): string {
  if (key === "backupPath") return "Backup guardado para recuperación";
  if (value && typeof value === "object" && "antes" in value && "despues" in value) return `${formatAuditValue(value.antes)} -> ${formatAuditValue(value.despues)}`;
  if (Array.isArray(value)) return `${value.length} registros`;
  if (value && typeof value === "object") return "Detalle guardado internamente";
  if (key.toLowerCase().includes("path")) return "Guardado";
  return formatAuditValue(value);
}

function formatAuditValue(value: any) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString("es-AR") : "-";
  return String(value ?? "-");
}
