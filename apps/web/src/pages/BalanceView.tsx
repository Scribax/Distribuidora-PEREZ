import React, { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, DollarSign, PackageCheck, Receipt, ReceiptText, ShoppingCart, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { useApi } from "../api";
import type { Dashboard } from "../types";
import { money } from "../utils";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleString("es-AR", { month: "long" }));

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

  const resultado = Number(data.resultado);
  const positivo = resultado >= 0;
  const periodoLabel = `${MONTHS[month - 1]} ${year}`;
  const metrics = [
    { label: "Ventas", value: money(data.ventas), Icon: ReceiptText, tone: "red" },
    { label: "Costo vendido", value: money(data.costoVendido), Icon: ShoppingCart, tone: "blue" },
    { label: "Ganancia bruta", value: money(data.gananciaBruta), Icon: TrendingUp, tone: "green" },
    { label: "Gastos", value: money(data.gastos), Icon: TrendingDown, tone: "amber" },
    { label: "Compras de stock", value: money(data.compras), Icon: ShoppingCart, tone: "blue" },
    { label: "Valor stock", value: money(data.valorStock), Icon: PackageCheck, tone: "slate" }
  ];

  return <div className="balance-page balance-v2">
    <section className="balance-hero">
      <div className="balance-hero-info">
        <span className="eyebrow">Balance del período</span>
        <h2>{periodoLabel}</h2>
        <p>Caja, deudas y resultado general del mes elegido.</p>
      </div>
      <form className="balance-period" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <label><span>Año</span><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
        <label><span>Mes</span><select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}</select></label>
        <button>Ver período</button>
      </form>
    </section>

    <section className={`balance-result ${positivo ? "positive" : "negative"}`}>
      <div className="balance-result-icon"><DollarSign size={26} /></div>
      <div className="balance-result-text">
        <span>Ganancia neta del período</span>
        <strong>{money(resultado)}</strong>
        <small>{positivo ? "El período cerró con resultado positivo" : "El período cerró en rojo: los egresos superan los ingresos"}</small>
      </div>
    </section>

    <div className="balance-metrics-v2">
      {metrics.map(({ label, value, Icon, tone }) => <article key={label} className={`metric-v2 tone-${tone}`}>
        <div><span>{label}</span><strong>{value}</strong></div>
        <span className="metric-icon"><Icon size={20} /></span>
      </article>)}
    </div>

    <section className="cashbox-panel">
      <div className="section-title"><h3>Caja por método</h3><span>Cobros de ventas menos gastos del período.</span></div>
      <div className="cashbox-grid">
        {cashbox.items.map((item: any) => <div className={`cashbox-card ${Number(item.saldo) < 0 ? "negative" : "positive"}`} key={item.metodoPago}>
          <span className="cashbox-method"><span className="cashbox-method-icon">{paymentIcon(item.metodoPago)}</span>{paymentLabel(item.metodoPago)}</span>
          <strong>{money(item.saldo)}</strong>
          <small>Ingresos {money(item.ingresos)} · Egresos {money(item.egresos)}</small>
        </div>)}
      </div>
    </section>

    <section className="balance-chart-panel">
      <div className="section-title"><h3>Comparativo últimos 6 meses</h3><span>Ventas, ganancia bruta y gastos mes a mes.</span></div>
      <div className="balance-chart">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={dashboard.chart} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} tickFormatter={(v) => new Intl.NumberFormat("es-AR", { notation: "compact" }).format(Number(v))} />
            <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid var(--line)" }} />
            <Legend />
            <Bar name="Ventas" dataKey="ventas" fill="#e21b23" radius={[4, 4, 0, 0]} />
            <Bar name="Ganancia bruta" dataKey="gananciaBruta" fill="#1558a8" radius={[4, 4, 0, 0]} />
            <Bar name="Gastos" dataKey="gastos" fill="#f2c94c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  </div>;
}

function paymentLabel(value: string) {
  const labels: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", TARJETA: "Tarjeta", CHEQUE: "Cheque", OTRO: "Otro" };
  return labels[value] ?? value;
}

function paymentIcon(value: string) {
  if (value === "EFECTIVO") return <Banknote size={15} />;
  if (value === "TRANSFERENCIA") return <Wallet size={15} />;
  if (value === "TARJETA") return <CreditCard size={15} />;
  if (value === "CHEQUE") return <Receipt size={15} />;
  return <DollarSign size={15} />;
}
