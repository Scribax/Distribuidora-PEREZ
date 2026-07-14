import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Boxes, DollarSign, PackageCheck, ReceiptText, ShoppingCart, TrendingDown, TrendingUp, Users, X, Package } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DashboardView({ api, onNavigate }: { api: ReturnType<typeof useApi>; onNavigate: (view: string) => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [showStockBajo, setShowStockBajo] = useState(false);
  useEffect(() => { api("/dashboard").then(setData).catch((err) => setError(err?.message ?? "No se pudo cargar el panel")); }, [api]);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Cargando...</p>;
  const metrics = [
    { label: "Ventas del mes", value: money(data.ventasMes), Icon: ReceiptText, tone: "red" },
    { label: "Costo vendido", value: money(data.costoVendidoMes ?? 0), Icon: ShoppingCart, tone: "blue" },
    { label: "Gastos", value: money(data.gastosMes ?? 0), Icon: TrendingDown, tone: "amber" },
    { label: "Ganancia neta", value: money(data.balanceMes), Icon: DollarSign, tone: "green" },
    { label: "Valor stock", value: money(data.valorStock), Icon: PackageCheck, tone: "slate" }
  ];
  const quickActions = [
    { view: "remitos", label: "Nueva venta", help: "Cargar boleta, pago o venta fiada", Icon: ReceiptText, tone: "red" },
    { view: "clientes", label: "Clientes", help: "Saldos, cuenta corriente e historial", Icon: Users, tone: "blue" },
    { view: "productos", label: "Productos", help: "Precios, catalogo y altas", Icon: Boxes, tone: "amber" },
    { view: "stock", label: "Stock", help: "Minimos, ajustes y movimientos", Icon: ShoppingCart, tone: "green" }
  ];
  return <div className="dashboard-page dashboard-v2">
    <section className="dashboard-hero">
      <div>
        <span className="eyebrow">Panel operativo</span>
        <h2>Resumen para decidir que mover hoy</h2>
        <p>Ventas, margen, gastos y reposicion en una vista rapida para operar sin perder contexto.</p>
      </div>
      <button type="button" onClick={() => onNavigate("remitos")}><ReceiptText size={18} /> Cargar venta</button>
    </section>
    <div className="dashboard-metrics-v2">
      {metrics.map(({ label, value, Icon, tone }) => <article key={label} className={`metric-v2 tone-${tone}`}>
        <div>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
        <span className="metric-icon"><Icon size={20} /></span>
      </article>)}
    </div>

    {data.stockBajo.length > 0 && (
      <button type="button" className="stock-alert-banner" onClick={() => setShowStockBajo(true)}>
        <span className="stock-alert-banner-icon"><AlertTriangle size={18} /></span>
        <span className="stock-alert-banner-text">
          <strong>{data.stockBajo.length} producto{data.stockBajo.length !== 1 ? "s" : ""} con stock bajo</strong>
          <span>Algunos artículos necesitan reposición urgente</span>
        </span>
        <span className="stock-alert-banner-cta">Ver listado <ArrowRight size={15} /></span>
      </button>
    )}

    <div className="quick-actions">
      {quickActions.map(({ view, label, help, Icon, tone }) => <button type="button" className={`quick-action tone-${tone}`} key={view} onClick={() => onNavigate(view)}>
        <span className="quick-icon"><Icon size={20} /></span>
        <span>
          <strong>{label}</strong>
          <small>{help}</small>
        </span>
        <ArrowRight size={18} />
      </button>)}
    </div>
    <div className="grid two dashboard-grid">
      <section className="panel chart-panel"><div className="section-title"><div><h2>Ventas y ganancia</h2><span>Evolucion mensual</span></div><TrendingUp size={20} /></div><ResponsiveContainer width="100%" height={280}><BarChart data={data.chart}><CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" /><XAxis dataKey="mes" /><YAxis /><Tooltip /><Legend /><Bar dataKey="ventas" fill="var(--brand-red)" /><Bar dataKey="gananciaNeta" fill="var(--brand-blue)" /><Bar dataKey="gastos" fill="var(--brand-yellow)" /></BarChart></ResponsiveContainer></section>
      <section className="panel"><div className="section-title"><div><h2>Ultimas boletas</h2><span>Ventas recientes para seguimiento</span></div></div><Table rows={data.ultimosRemitos.map(formatRemitoRow)} cols={[["numero", "Nro"], ["cliente.nombre", "Cliente"], ["totalFmt", "Total"], ["pagoEstado", "Pago"], ["estado", "Estado"]]} /></section>
    </div>

    {showStockBajo && (
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Productos con stock bajo" onClick={() => setShowStockBajo(false)}>
        <section className="stock-bajo-modal" onClick={(e) => e.stopPropagation()}>
          <div className="stock-bajo-modal-header">
            <div className="stock-bajo-modal-title">
              <span className="stock-bajo-modal-icon"><AlertTriangle size={22} /></span>
              <div>
                <h2>Productos con stock bajo</h2>
                <span>{data.stockBajo.length} artículo{data.stockBajo.length !== 1 ? "s" : ""} para reponer</span>
              </div>
            </div>
            <button type="button" className="icon-button" onClick={() => setShowStockBajo(false)} title="Cerrar"><X size={20} /></button>
          </div>
          <div className="stock-bajo-modal-list">
            {data.stockBajo.map((p) => {
              const deficit = p.stockMinimo - p.stockActual;
              const pct = Math.min(100, Math.round((p.stockActual / Math.max(p.stockMinimo, 1)) * 100));
              return (
                <div key={p.id} className="stock-bajo-row">
                  <span className="stock-bajo-icon"><Package size={16} /></span>
                  <div className="stock-bajo-info">
                    <strong>{p.nombre}</strong>
                    <span>{p.categoria?.nombre ?? "Sin rubro"}</span>
                    <div className="stock-bajo-bar-wrap">
                      <div className="stock-bajo-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="stock-bajo-numbers">
                    <span className="stock-bajo-actual">{p.stockActual}</span>
                    <span className="stock-bajo-min">mín. {p.stockMinimo}</span>
                    {deficit > 0 && <span className="stock-bajo-deficit">faltan {deficit}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="stock-bajo-modal-footer">
            <button type="button" className="secondary" onClick={() => setShowStockBajo(false)}>Cerrar</button>
            <button type="button" onClick={() => { setShowStockBajo(false); onNavigate("stock"); }}>Ir a Stock <ArrowRight size={15} /></button>
          </div>
        </section>
      </div>
    )}
  </div>;
}
