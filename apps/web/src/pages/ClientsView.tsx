import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, openPdfViewer, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";

const CLIENTS_PAGE_SIZE = 10;

export function ClientsView({ api, canWrite, canEditBalance }: { api: ReturnType<typeof useApi>; canWrite: boolean; canEditBalance: boolean }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [page, setPage] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const load = (term = q, nextPage = page): Promise<void> => api(`/clientes?${qs({ q: term, page: nextPage, pageSize: CLIENTS_PAGE_SIZE })}`).then((d) => {
    const resultTotal = d.total ?? d.items.length;
    if (!d.items.length && resultTotal > 0 && nextPage > 1) return load(term, nextPage - 1);
    setClients(d.items);
    setTotalClients(resultTotal);
    setPage(d.page ?? nextPage);
  });
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
      await load(q, 1);
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
      await load(q, page);
      await reloadSelected(selectedClient.id);
    } catch (err: any) {
      setError(err.message ?? "No se pudo actualizar el cliente");
    }
  }
  async function openClientRemitoPdf(remito: any) {
    setError("");
    try {
      const blob = await api(`/remitos/${remito.id}/pdf`, { headers: { Accept: "application/pdf" } });
      openPdfViewer(blob, `Boleta #${remito.numero}`);
    } catch (err: any) {
      setError(err.message ?? "No se pudo abrir el PDF");
    }
  }
  const clientRows = clients.map((client) => ({ ...client, saldoFmt: money(client.saldoPendiente), estadoFmt: client.activo ? "Activo" : "Inactivo" }));
  const totalSaldo = clients.reduce((sum, client) => sum + Number(client.saldoPendiente), 0);
  const activeCount = clients.filter((client) => client.activo).length;
  const totalPages = Math.max(1, Math.ceil(totalClients / CLIENTS_PAGE_SIZE));
  const firstVisible = totalClients === 0 ? 0 : (page - 1) * CLIENTS_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * CLIENTS_PAGE_SIZE, totalClients);
  const goToPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(safePage);
    load(q, safePage);
  };
  return <div className="client-page">
    <section className="client-overview">
      <Metric label="Clientes encontrados" value={String(totalClients)} />
      <Metric label="Activos en página" value={String(activeCount)} />
      <Metric label="Saldo en página" value={money(totalSaldo)} />
    </section>
    <section className="panel wide client-list-panel">
      <div className="detail-head"><div><h2>Clientes</h2><span>Seleccioná un cliente para ver saldo, datos y boletas pendientes.</span></div></div>
      <SearchBox q={q} setQ={setQ} onSearch={(e) => { e?.preventDefault(); setPage(1); load(q, 1); }} onClear={() => { setQ(""); setPage(1); load("", 1); }} placeholder="Buscar por nombre, empresa o email" />
      <div className="client-list-toolbar">
        <span>{firstVisible}-{lastVisible} de {totalClients} clientes</span>
        <div className="pager compact-pager">
          <button type="button" className="secondary" onClick={() => goToPage(page - 1)} disabled={page === 1}>Anterior</button>
          <span>Página {page} de {totalPages}</span>
          <button type="button" className="secondary" onClick={() => goToPage(page + 1)} disabled={page === totalPages}>Siguiente</button>
        </div>
      </div>
      <div className="client-list">{clientRows.map((client) => <button type="button" className={`client-card ${selectedClient?.id === client.id ? "active" : ""}`} key={client.id} onClick={() => openClient(client)}><div><strong>{client.nombre}</strong><span>{client.empresa || "Consumidor final"}</span></div><div><span>Saldo</span><strong>{client.saldoFmt}</strong></div><small>{client.estadoFmt}</small></button>)}{!clientRows.length && <p className="muted">No hay clientes con esa búsqueda.</p>}</div>
    </section>
    {selectedClient && <div className="modal-backdrop client-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Cliente ${selectedClient.nombre}`} onClick={() => setSelectedClient(null)}>
      <ClientDetail client={selectedClient} canWrite={canWrite} canEditBalance={canEditBalance} onUpdate={updateClient} onClose={() => setSelectedClient(null)} onPdf={openClientRemitoPdf} />
    </div>}
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
    <label className="field-label"><span>Nombre del cliente</span><input name="nombre" defaultValue={client?.nombre} placeholder="Ej: Oscar Catalan" required /></label>
    <label className="field-label"><span>Empresa o comercio</span><input name="empresa" defaultValue={client?.empresa ?? ""} placeholder="Ej: Kiosco Centro" /></label>
    <label className="field-label"><span>Teléfono</span><input name="telefono" defaultValue={client?.telefono ?? ""} placeholder="Ej: 2604555555" /></label>
    <label className="field-label"><span>Email</span><input name="email" type="email" defaultValue={client?.email ?? ""} placeholder="Ej: cliente@email.com" /></label>
    <label className="field-label"><span>Dirección</span><input name="direccion" defaultValue={client?.direccion ?? ""} placeholder="Calle, número, barrio" /></label>
    <label className="field-label"><span>Observaciones</span><input name="observaciones" defaultValue={client?.observaciones ?? ""} placeholder="Notas internas del cliente" /></label>
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
  return <section className="panel detail-panel client-profile client-detail-modal" onClick={(event) => event.stopPropagation()}>
    <div className="client-hero"><div><h2>{client.nombre}</h2><span>{client.empresa ?? "Sin empresa registrada"}</span></div><button type="button" className="icon-button" onClick={onClose} title="Cerrar detalle"><X size={18} /></button></div>
    <div className="detail-grid">
      <Metric label="Saldo pendiente" value={money(client.saldoPendiente)} /><Metric label="Boletas con deuda" value={String(pendingRemitos.length)} /><Metric label="Total vendido" value={money(totalRemitos)} /><Metric label="Última boleta" value={lastRemito ? `#${lastRemito.numero}` : "-"} />
    </div>
    <div className="client-info-grid">
      <InfoItem label="Estado" value={client.activo ? "Activo" : "Inactivo"} /><InfoItem label="Teléfono" value={client.telefono || "-"} /><InfoItem label="Email" value={client.email || "-"} /><InfoItem label="Dirección" value={client.direccion || "-"} />
    </div>
    <div className="client-remittances"><h3>Boletas del cliente</h3><span>Primero aparecen las que tienen saldo pendiente.</span><div className="client-remito-list">{remitoRows.map((row) => <ClientRemitoCard row={row} key={row.id} onPdf={onPdf} />)}{!remitoRows.length && <p className="muted">Este cliente todavía no tiene boletas.</p>}</div></div>
    {canWrite && <div className="client-edit-box"><button type="button" className="secondary" onClick={() => setEditing(true)}>Editar datos del cliente</button></div>}
    {editing && <ClientEditModal client={client} canEditBalance={canEditBalance} onUpdate={onUpdate} onClose={() => setEditing(false)} />}
  </section>;
}

function ClientEditModal({ client, canEditBalance, onUpdate, onClose }: { client: Client; canEditBalance: boolean; onUpdate: (event: React.FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return <div className="modal-backdrop client-edit-backdrop" role="dialog" aria-modal="true" aria-label={`Editar cliente ${client.nombre}`} onClick={onClose}>
    <section className="client-edit-modal" onClick={(event) => event.stopPropagation()}>
      <div className="detail-head">
        <div><h2>Editar cliente</h2><span>{client.nombre}</span></div>
        <button type="button" className="icon-button" onClick={onClose} title="Cerrar edición"><X size={18} /></button>
      </div>
      <form className="form client-edit-form" onSubmit={onUpdate}>
        <ClientFields client={client} />
        {canEditBalance && <label className="field-label"><span>Saldo pendiente</span><input name="saldoPendiente" type="number" step="0.01" min="0" defaultValue={Number(client.saldoPendiente)} placeholder="0,00" /></label>}
        {canEditBalance && <label className="field-label"><span>Estado del cliente</span><select name="activo" defaultValue={String(client.activo)}><option value="true">Activo</option><option value="false">Inactivo</option></select></label>}
        <div className="modal-actions client-edit-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
          <button>Guardar cliente</button>
        </div>
      </form>
    </section>
  </div>;
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
