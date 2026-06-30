import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";

export function ClientsView({ api, canWrite, canEditBalance }: { api: ReturnType<typeof useApi>; canWrite: boolean; canEditBalance: boolean }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const load = (term = q) => api(`/clientes?${qs({ q: term, pageSize: 100 })}`).then((d) => setClients(d.items));
  useEffect(() => { load(); }, []);
  async function openClient(client: Client) {
    setSelectedClient(await api(`/clientes/${client.id}`));
  }
  async function reloadSelected(id?: string) {
    if (id) setSelectedClient(await api(`/clientes/${id}`));
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setError("");
    try {
      await api("/clientes", { method: "POST", body: JSON.stringify(clientBody(payload(formEl))) });
      formEl.reset();
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo crear el cliente");
    }
  }
  async function updateClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClient) return;
    const form = payload(event.currentTarget);
    const body = clientBody(form) as Record<string, unknown>;
    if (canEditBalance) {
      body.saldoPendiente = Number(form.saldoPendiente ?? selectedClient.saldoPendiente);
      body.activo = form.activo === "true";
    }
    try {
      await api(`/clientes/${selectedClient.id}`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
      await reloadSelected(selectedClient.id);
    } catch (err: any) {
      setError(err.message ?? "No se pudo actualizar el cliente");
    }
  }
  async function openClientRemitoPdf(remito: any) {
    setError("");
    try {
      const blob = await api(`/remitos/${remito.id}/pdf`, { headers: { Accept: "application/pdf" } });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      setError(err.message ?? "No se pudo abrir el PDF");
    }
  }
  const clientRows = clients.map((client) => ({ ...client, saldoFmt: money(client.saldoPendiente), estadoFmt: client.activo ? "Activo" : "Inactivo" }));
  const totalSaldo = clients.reduce((sum, client) => sum + Number(client.saldoPendiente), 0);
  const activeCount = clients.filter((client) => client.activo).length;
  return <div className="client-page">
    <section className="client-overview">
      <Metric label="Clientes" value={String(clients.length)} />
      <Metric label="Activos" value={String(activeCount)} />
      <Metric label="Saldo total" value={money(totalSaldo)} />
    </section>
    <section className="panel wide client-list-panel">
      <div className="detail-head"><div><h2>Clientes</h2><span>Seleccioná un cliente para ver saldo, datos y boletas pendientes.</span></div></div>
      <SearchBox q={q} setQ={setQ} onSearch={(e) => { e?.preventDefault(); load(q); }} onClear={() => { setQ(""); load(""); }} placeholder="Buscar por nombre, empresa o email" />
      <div className="client-list">{clientRows.map((client) => <button type="button" className={`client-card ${selectedClient?.id === client.id ? "active" : ""}`} key={client.id} onClick={() => openClient(client)}><div><strong>{client.nombre}</strong><span>{client.empresa || "Consumidor final"}</span></div><div><span>Saldo</span><strong>{client.saldoFmt}</strong></div><small>{client.estadoFmt}</small></button>)}{!clientRows.length && <p className="muted">No hay clientes con esa búsqueda.</p>}</div>
    </section>
    {selectedClient && <ClientDetail client={selectedClient} canWrite={canWrite} canEditBalance={canEditBalance} onUpdate={updateClient} onClose={() => setSelectedClient(null)} onPdf={openClientRemitoPdf} />}
    {canWrite && <section className="panel"><h2>Nuevo cliente</h2><form className="form client-form" onSubmit={create}><ClientFields />{error && <p className="error">{error}</p>}<button>Crear cliente</button></form></section>}
  </div>;
}

function clientBody(form: Record<string, FormDataEntryValue>) {
  const email = String(form.email ?? "").trim();
  return {
    nombre: String(form.nombre),
    empresa: String(form.empresa ?? ""),
    direccion: String(form.direccion ?? ""),
    telefono: String(form.telefono ?? ""),
    email: email || undefined,
    observaciones: String(form.observaciones ?? "")
  };
}

function ClientFields({ client }: { client?: Client }) {
  return <>
    <input name="nombre" defaultValue={client?.nombre} placeholder="Nombre" required />
    <input name="empresa" defaultValue={client?.empresa ?? ""} placeholder="Empresa" />
    <input name="telefono" defaultValue={client?.telefono ?? ""} placeholder="Teléfono" />
    <input name="email" type="email" defaultValue={client?.email ?? ""} placeholder="Email" />
    <input name="direccion" defaultValue={client?.direccion ?? ""} placeholder="Dirección" />
    <input name="observaciones" defaultValue={client?.observaciones ?? ""} placeholder="Observaciones" />
  </>;
}

function ClientDetail({ client, canWrite, canEditBalance, onUpdate, onClose, onPdf }: { client: Client; canWrite: boolean; canEditBalance: boolean; onUpdate: (event: React.FormEvent<HTMLFormElement>) => void; onClose: () => void; onPdf: (row: any) => void }) {
  const [editing, setEditing] = useState(false);
  const remitos = client.remitos ?? [];
  const activeRemitos = remitos.filter((r) => r.estado === "ACTIVO");
  const totalRemitos = activeRemitos.reduce((sum, r) => sum + Number(r.total), 0);
  const lastRemito = remitos[0];
  const remitoRows = [...remitos].sort((a, b) => {
    const debtA = remitoPending(a);
    const debtB = remitoPending(b);
    if (debtA !== debtB) return debtB - debtA;
    return Number(b.numero) - Number(a.numero);
  }).map(formatRemitoRow);
  const pendingRemitos = activeRemitos.filter((r) => remitoPending(r) > 0);
  return <section className="panel detail-panel client-profile">
    <div className="client-hero"><div><h2>{client.nombre}</h2><span>{client.empresa ?? "Sin empresa registrada"}</span></div><button type="button" className="icon-button" onClick={onClose} title="Cerrar detalle"><X size={18} /></button></div>
    <div className="detail-grid">
      <Metric label="Saldo pendiente" value={money(client.saldoPendiente)} /><Metric label="Boletas con deuda" value={String(pendingRemitos.length)} /><Metric label="Total vendido" value={money(totalRemitos)} /><Metric label="Última boleta" value={lastRemito ? `#${lastRemito.numero}` : "-"} />
    </div>
    <div className="client-info-grid">
      <InfoItem label="Estado" value={client.activo ? "Activo" : "Inactivo"} /><InfoItem label="Teléfono" value={client.telefono || "-"} /><InfoItem label="Email" value={client.email || "-"} /><InfoItem label="Dirección" value={client.direccion || "-"} />
    </div>
    <div className="client-remittances"><h3>Boletas del cliente</h3><span>Primero aparecen las que tienen saldo pendiente.</span><div className="client-remito-list">{remitoRows.map((row) => <ClientRemitoCard row={row} key={row.id} onPdf={onPdf} />)}{!remitoRows.length && <p className="muted">Este cliente todavía no tiene boletas.</p>}</div></div>
    {canWrite && <div className="client-edit-box"><button type="button" className="secondary" onClick={() => setEditing(!editing)}>{editing ? "Ocultar edición" : "Editar datos del cliente"}</button>{editing && <form className="form" onSubmit={onUpdate}><h3>Editar cliente</h3><ClientFields client={client} />{canEditBalance && <input name="saldoPendiente" type="number" step="0.01" min="0" defaultValue={Number(client.saldoPendiente)} placeholder="Saldo pendiente" />} {canEditBalance && <select name="activo" defaultValue={String(client.activo)}><option value="true">Activo</option><option value="false">Inactivo</option></select>}<button>Guardar cliente</button></form>}</div>}
  </section>;
}

function ClientRemitoCard({ row, onPdf }: { row: any; onPdf: (row: any) => void }) {
  const [open, setOpen] = useState(false);
  const pending = remitoPending(row);
  const paid = row.pagoEstado === "PAGADA" ? Number(row.total) : Number(row.montoPagado ?? 0);
  return <article className={`client-remito-card ${pending > 0 ? "pending" : ""}`}>
    <div><strong>Boleta #{row.numero}</strong><span>{row.fechaCorta} · {row.itemsCount} ítem{row.itemsCount === 1 ? "" : "s"}</span></div>
    <div className="sale-badges"><span className={`status-chip ${String(row.pagoEstado).toLowerCase()}`}>{row.pagoEstado}</span><span className={`status-chip ${String(row.estado).toLowerCase()}`}>{row.estado}</span></div>
    <div><strong>{row.totalFmt}</strong><span>Pagado {money(paid)} · pendiente {money(pending)}</span></div>
    <div className="client-remito-actions"><button type="button" className="secondary" onClick={() => setOpen(!open)}>{open ? "Ocultar" : "Ver detalle"}</button><button type="button" className="secondary" onClick={() => onPdf(row)}>PDF</button></div>
    {open && <div className="client-remito-detail"><div><strong>Vendedor</strong><span>{row.vendedor?.nombre ?? "Sin vendedor"}</span></div><div><strong>Productos</strong><span>{(row.items ?? []).map((item: any) => `${item.cantidad} x ${item.nombreProducto}`).join(" · ") || "-"}</span></div></div>}
  </article>;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div className="info-item"><span>{label}</span><strong>{value}</strong></div>;
}

