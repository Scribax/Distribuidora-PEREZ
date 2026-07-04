import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Boxes, DollarSign, PackageCheck, ReceiptText, ShoppingCart, TrendingDown, TrendingUp, Users } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
export function DashboardView({ api, onNavigate }: { api: ReturnType<typeof useApi>; onNavigate: (view: string) => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
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
      <section className="panel alert-panel"><div className="section-title"><div><h2>Stock bajo</h2><span>Productos para reponer</span></div><AlertTriangle size={20} /></div>{data.stockBajo.length ? data.stockBajo.map((p) => <Row key={p.id} title={p.nombre} meta={`${p.stockActual} / minimo ${p.stockMinimo}`} />) : <p>Sin alertas.</p>}</section>
    </div>
    <section className="panel"><div className="section-title"><div><h2>Ultimas boletas</h2><span>Ventas recientes para seguimiento</span></div></div><Table rows={data.ultimosRemitos.map(formatRemitoRow)} cols={[["numero", "Nro"], ["cliente.nombre", "Cliente"], ["totalFmt", "Total"], ["pagoEstado", "Pago"], ["estado", "Estado"]]} /></section>
  </div>;
}
