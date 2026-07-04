import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, ReceiptText, Search, ShoppingCart, Trash2, TrendingUp, Users, X } from "lucide-react";
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
  const quickActions = [
    { view: "remitos", label: "Nueva venta", help: "Cargar boleta o pago", Icon: ReceiptText },
    { view: "clientes", label: "Ver clientes", help: "Saldos e historial", Icon: Users },
    { view: "productos", label: "Productos", help: "Precios y catalogo", Icon: Boxes },
    { view: "stock", label: "Control stock", help: "Minimos y ajustes", Icon: ShoppingCart }
  ];
  return <div className="dashboard-page">
    <section className="dashboard-hero">
      <div>
        <span className="eyebrow">Panel principal</span>
        <h2>Lo importante del negocio en un solo lugar</h2>
        <p>Ventas, gastos, ganancia y alertas de stock para decidir rapido que hacer.</p>
      </div>
      <button type="button" onClick={() => onNavigate("remitos")}><ReceiptText size={18} /> Cargar venta</button>
    </section>
    <div className="metrics dashboard-metrics">
      <Metric label="Ventas del mes" value={money(data.ventasMes)} />
      <Metric label="Costo vendido" value={money(data.costoVendidoMes ?? 0)} />
      <Metric label="Gastos" value={money(data.gastosMes ?? 0)} />
      <Metric label="Ganancia neta" value={money(data.balanceMes)} />
      <Metric label="Valor stock" value={money(data.valorStock)} />
    </div>
    <div className="quick-actions">
      {quickActions.map(({ view, label, help, Icon }) => <button type="button" key={view} onClick={() => onNavigate(view)}>
        <Icon size={20} />
        <strong>{label}</strong>
        <span>{help}</span>
      </button>)}
    </div>
    <div className="grid two dashboard-grid">
      <section className="panel chart-panel"><div className="section-title"><div><h2>Ventas y ganancia</h2><span>Evolucion mensual</span></div><TrendingUp size={20} /></div><ResponsiveContainer width="100%" height={280}><BarChart data={data.chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis /><Tooltip /><Legend /><Bar dataKey="ventas" fill="#e21b23" /><Bar dataKey="gananciaNeta" fill="#1558a8" /><Bar dataKey="gastos" fill="#f2c94c" /></BarChart></ResponsiveContainer></section>
      <section className="panel alert-panel"><div className="section-title"><div><h2>Stock bajo</h2><span>Productos para reponer</span></div><AlertTriangle size={20} /></div>{data.stockBajo.length ? data.stockBajo.map((p) => <Row key={p.id} title={p.nombre} meta={`${p.stockActual} / minimo ${p.stockMinimo}`} />) : <p>Sin alertas.</p>}</section>
    </div>
    <section className="panel"><div className="section-title"><div><h2>Ultimas boletas</h2><span>Ventas recientes para seguimiento</span></div></div><Table rows={data.ultimosRemitos.map(formatRemitoRow)} cols={[["numero", "Nro"], ["cliente.nombre", "Cliente"], ["totalFmt", "Total"], ["pagoEstado", "Pago"], ["estado", "Estado"]]} /></section>
  </div>;
}

