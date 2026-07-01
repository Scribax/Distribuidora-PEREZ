import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
export function DashboardView({ api }: { api: ReturnType<typeof useApi> }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/dashboard").then(setData).catch((err) => setError(err?.message ?? "No se pudo cargar el panel")); }, [api]);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Cargando...</p>;
  return <>
    <div className="metrics">
      <Metric label="Ventas del mes" value={money(data.ventasMes)} />
      <Metric label="Costo vendido" value={money(data.costoVendidoMes ?? 0)} />
      <Metric label="Gastos" value={money(data.gastosMes ?? 0)} />
      <Metric label="Ganancia neta" value={money(data.balanceMes)} />
      <Metric label="Valor stock" value={money(data.valorStock)} />
    </div>
    <div className="grid two">
      <section className="panel"><h2>Ventas y ganancia</h2><ResponsiveContainer width="100%" height={260}><BarChart data={data.chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis /><Tooltip /><Legend /><Bar dataKey="ventas" fill="#e21b23" /><Bar dataKey="gananciaNeta" fill="#1558a8" /><Bar dataKey="gastos" fill="#f2c94c" /></BarChart></ResponsiveContainer></section>
      <section className="panel"><h2>Stock bajo</h2>{data.stockBajo.length ? data.stockBajo.map((p) => <Row key={p.id} title={p.nombre} meta={`${p.stockActual} / mínimo ${p.stockMinimo}`} />) : <p>Sin alertas.</p>}</section>
    </div>
    <section className="panel"><h2>Últimas boletas</h2><Table rows={data.ultimosRemitos.map(formatRemitoRow)} cols={[["numero", "Nro"], ["cliente.nombre", "Cliente"], ["totalFmt", "Total"], ["pagoEstado", "Pago"], ["estado", "Estado"]]} /></section>
  </>;
}

