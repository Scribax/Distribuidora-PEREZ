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
  return <div className="grid two">
    <section className="panel wide">
      <h2>Informes</h2>
      <div className="filters">
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2026, i, 1).toLocaleString("es-AR", { month: "long" })}</option>)}</select>
      </div>
      <div className="report-list">{reportRows.map(([kind, label]) => <div className="report-row" key={kind}><strong>{label}</strong><div className="table-actions"><button type="button" className="secondary" onClick={() => download(kind, "pdf")}>PDF</button><button type="button" className="secondary" onClick={() => download(kind, "xlsx")}>Excel</button></div></div>)}</div>
    </section>
  </div>;
}

