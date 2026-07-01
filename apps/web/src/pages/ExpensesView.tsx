import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";

const expenseCategories = ["COMBUSTIBLE", "FLETE", "ALQUILER", "SUELDOS", "SERVICIOS", "MANTENIMIENTO", "INSUMOS", "IMPUESTOS", "OTRO"];

export function ExpensesView({ api, isAdmin }: { api: ReturnType<typeof useApi>; isAdmin: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ q: "", categoria: "", fechaDesde: "", fechaHasta: "" });
  const [error, setError] = useState("");
  const load = (next = filters) => api(`/gastos?${qs({ ...next, pageSize: 100 })}`).then((data) => { setRows(data.items); setTotal(data.montoTotal ?? 0); }).catch((err) => setError(err?.message ?? "No se pudieron cargar los gastos"));
  useEffect(() => { load(); }, []);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = payload(formEl);
    setError("");
    try {
      await api("/gastos", { method: "POST", body: JSON.stringify({ fecha: form.fecha, categoria: form.categoria, descripcion: form.descripcion, monto: Number(form.monto), metodoPago: form.metodoPago || null, comprobante: form.comprobante || null, observaciones: form.observaciones || null }) });
      formEl.reset();
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo registrar el gasto");
    }
  }
  async function remove(row: any) {
    if (!confirmAction(`¿Eliminar el gasto "${row.descripcion}"?`)) return;
    setError("");
    try {
      await api(`/gastos/${row.id}`, { method: "DELETE" });
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo eliminar el gasto");
    }
  }
  return <div className="expenses-page">
    <section className="panel wide">
      <div className="detail-head"><div><h2>Gastos</h2><span>Salidas de plata que no modifican stock, pero sí bajan la ganancia neta.</span></div><Metric label="Total filtrado" value={money(total)} /></div>
      <form className="filters filters-wide" onSubmit={(e) => { e.preventDefault(); load(filters); }}>
        <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Buscar gasto" />
        <select value={filters.categoria} onChange={(e) => setFilters({ ...filters, categoria: e.target.value })}><option value="">Todas las categorías</option>{expenseCategories.map((category) => <option key={category} value={category}>{expenseLabel(category)}</option>)}</select>
        <input type="date" value={filters.fechaDesde} onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })} />
        <input type="date" value={filters.fechaHasta} onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })} />
        <button>Filtrar</button><button type="button" className="secondary" onClick={() => { const clean = { q: "", categoria: "", fechaDesde: "", fechaHasta: "" }; setFilters(clean); load(clean); }}>Limpiar</button>
      </form>
      <div className="expense-list">{rows.map((row) => <div className="expense-row" key={row.id}><div><strong>{row.descripcion}</strong><span>{formatDate(row.fecha)} · {expenseLabel(row.categoria)} · {row.metodoPago ?? "Sin método"}</span><small>{row.comprobante || row.observaciones || row.usuario?.nombre}</small></div><strong>{money(row.monto)}</strong>{isAdmin && <button type="button" className="icon-button" onClick={() => remove(row)} title="Eliminar gasto"><Trash2 size={16} /></button>}</div>)}{!rows.length && <p className="muted">No hay gastos con estos filtros.</p>}</div>
    </section>
    <section className="panel expense-form-panel">
      <h2>Nuevo gasto</h2>
      <form className="form expense-form" onSubmit={create}>
        <label className="field-label"><span>Fecha</span><input name="fecha" type="date" defaultValue={dateInput()} required /></label>
        <label className="field-label"><span>Categoría</span><select name="categoria" defaultValue="COMBUSTIBLE">{expenseCategories.map((category) => <option key={category} value={category}>{expenseLabel(category)}</option>)}</select></label>
        <label className="field-label expense-description"><span>Descripción</span><input name="descripcion" placeholder="Ej. Combustible reparto" required /></label>
        <label className="field-label"><span>Monto</span><input name="monto" type="number" step="0.01" min="0.01" placeholder="0,00" required /></label>
        <label className="field-label"><span>Método de pago</span><select name="metodoPago"><option value="">Sin método</option><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="TARJETA">Tarjeta</option><option value="CHEQUE">Cheque</option><option value="OTRO">Otro</option></select></label>
        <label className="field-label"><span>Comprobante</span><input name="comprobante" placeholder="Número o referencia" /></label>
        <label className="field-label expense-notes"><span>Observaciones</span><textarea name="observaciones" placeholder="Detalle opcional" rows={3} /></label>
        {error && <p className="error">{error}</p>}
        <button>Registrar gasto</button>
      </form>
    </section>
  </div>;
}
