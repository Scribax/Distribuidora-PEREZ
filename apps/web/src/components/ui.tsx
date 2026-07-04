import React from "react";
import { Search } from "lucide-react";

export function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

export function Row({ title, meta }: { title: string; meta: string }) {
  return <div className="row"><strong>{title}</strong><span>{meta}</span></div>;
}

export function SearchBox({ q, setQ, onSearch, onClear, placeholder = "Buscar" }: { q: string; setQ: (v: string) => void; onSearch: (event?: React.FormEvent) => void; onClear: () => void; placeholder?: string }) {
  return <form className="search" onSubmit={onSearch}><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} /><button type="submit">Filtrar</button>{q && <button type="button" className="secondary" onClick={onClear}>Limpiar</button>}</form>;
}

function get(row: any, key: string) {
  return key.split(".").reduce((v, k) => v?.[k], row);
}

export function Table({ rows, cols, onRowClick, actions }: { rows: any[]; cols: [string, string][]; onRowClick?: (row: any) => void; actions?: (row: any) => React.ReactNode }) {
  return <div className="table-wrap responsive-table"><table><thead><tr>{cols.map(([, label]) => <th key={label}>{label}</th>)}{actions && <th>Acciones</th>}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id ?? i} className={onRowClick ? "clickable-row" : undefined} onClick={() => onRowClick?.(row)}>{cols.map(([key, label]) => <td key={key} data-label={label}>{String(get(row, key) ?? "-").slice(0, 90)}</td>)}{actions && <td data-label="Acciones" onClick={(event) => event.stopPropagation()}>{actions(row)}</td>}</tr>)}</tbody></table>{!rows.length && <p>No hay registros.</p>}</div>;
}

