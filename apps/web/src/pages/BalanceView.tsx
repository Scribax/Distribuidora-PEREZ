import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
export function BalanceView({ api }: { api: ReturnType<typeof useApi> }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<any | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [cashbox, setCashbox] = useState<any | null>(null);
  const [error, setError] = useState("");
  const load = () => { setError(""); return Promise.all([api(`/dashboard/balance?year=${year}&month=${month}`), api(`/dashboard/caja?year=${year}&month=${month}`), api("/dashboard")]).then(([balance, caja, dash]) => { setData(balance); setCashbox(caja); setDashboard(dash); }).catch((err) => setError(err?.message ?? "No se pudo cargar el balance")); };
  useEffect(() => { load(); }, []);
  if (error) return <p className="error">{error}</p>;
  if (!data || !dashboard || !cashbox) return <p>Cargando...</p>;
  return <div className="balance-page"><section className="panel wide balance-panel"><div className="filters balance-filters"><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /><select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2026, i, 1).toLocaleString("es-AR", { month: "long" })}</option>)}</select><button onClick={load}>Ver período</button></div><div className="balance-metrics"><Metric label="Ventas" value={money(data.ventas)} /><Metric label="Costo vendido" value={money(data.costoVendido)} /><Metric label="Ganancia bruta" value={money(data.gananciaBruta)} /><Metric label="Gastos" value={money(data.gastos)} /><Metric label="Ganancia neta" value={money(data.resultado)} /><Metric label="Compras de stock" value={money(data.compras)} /><Metric label="Valor stock" value={money(data.valorStock)} /></div><div className="cashbox-panel"><div className="section-title"><h3>Caja por método</h3><span>Cobros de ventas menos gastos del período.</span></div><div className="cashbox-grid">{cashbox.items.map((item: any) => <div className={`cashbox-card ${Number(item.saldo) < 0 ? "negative" : "positive"}`} key={item.metodoPago}><span>{paymentLabel(item.metodoPago)}</span><strong>{money(item.saldo)}</strong><small>Ingresos {money(item.ingresos)} · Egresos {money(item.egresos)}</small></div>)}</div></div><h2>Comparativo últimos 6 meses</h2><div className="balance-chart"><ResponsiveContainer width="100%" height={320}><BarChart data={dashboard.chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis /><Tooltip /><Legend /><Bar dataKey="ventas" fill="#e21b23" /><Bar dataKey="gananciaBruta" fill="#1558a8" /><Bar dataKey="gastos" fill="#f2c94c" /></BarChart></ResponsiveContainer></div></section></div>;
}

function paymentLabel(value: string) {
  const labels: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", TARJETA: "Tarjeta", CHEQUE: "Cheque", OTRO: "Otro" };
  return labels[value] ?? value;
}
