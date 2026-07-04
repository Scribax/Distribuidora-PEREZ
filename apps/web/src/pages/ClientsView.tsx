import React, { useEffect, useMemo, useState } from "react";
import { Copy, MessageCircle, Phone, Search, Send, Trash2, X } from "lucide-react";
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
  const [importText, setImportText] = useState("");
  const [importPdf, setImportPdf] = useState<File | null>(null);
  const [importFileKey, setImportFileKey] = useState(0);
  const [updateImportedBalance, setUpdateImportedBalance] = useState(true);

  const [activeTab, setActiveTab] = useState<"list" | "cobros">("list");
  const [cobros, setCobros] = useState<any[]>([]);
  const [cobrosLoading, setCobrosLoading] = useState(false);
  const [dias, setDias] = useState("5");
  const [cobrosSearch, setCobrosSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState<string | null>(null);

  const loadCobros = () => {
    setCobrosLoading(true);
    api(`/clientes/cobros-pendientes?dias=${dias}`)
      .then((data) => {
        setCobros(data.cobros || []);
      })
      .catch((err) => {
        window.alert(err.message ?? "Error al cargar cobros pendientes");
      })
      .finally(() => {
        setCobrosLoading(false);
      });
  };

  useEffect(() => {
    if (activeTab === "cobros") {
      loadCobros();
    }
  }, [activeTab]);

  const filteredCobros = useMemo(() => {
    const term = cobrosSearch.trim().toLowerCase();
    if (!term) return cobros;
    return cobros.filter((c) =>
      c.cliente_nombre.toLowerCase().includes(term) ||
      c.telefono.includes(term) ||
      String(c.numero).includes(term)
    );
  }, [cobros, cobrosSearch]);

  const totalPendiente = useMemo(() => {
    return filteredCobros.reduce((sum, c) => sum + Number(c.saldo), 0);
  }, [filteredCobros]);

  const buildMensaje = (saldo: number) => {
    const saldoFmt = money(saldo);
    const wave  = String.fromCodePoint(0x1F44B, 0x1F3FB);
    const bang  = String.fromCodePoint(0x203C, 0xFE0F);
    const smile = String.fromCodePoint(0x1F603);
    const cap   = String.fromCodePoint(0x1F9E2);
    return [
      "\u00A1Hola! " + wave,
      "Le recuerdo el saldo debido de " + saldoFmt + " " + bang,
      "Para transferir, el Alias: perezmartin.pagos a nombre de Eduardo Gregorio Perez.",
      "Aviseme si quiere que pase a cobrar en efectivo y si hace falta que lleve alg\u00FAn pedido.",
      "Muchas gracias " + smile,
      "Distribuidora Perez Martin " + cap
    ].join("\n\n");
  };

  const copyMessage = async (id: string, cobro: any) => {
    try {
      const texto = buildMensaje(cobro.saldo);
      await navigator.clipboard.writeText(texto);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.alert("No se pudo copiar el mensaje");
    }
  };

  const registrarYEnviar = async (cobro: any) => {
    const texto = buildMensaje(cobro.saldo);
    const waUrl = `https://wa.me/${cobro.telefono_whatsapp}?text=${encodeURIComponent(texto)}`;
    const win = window.open(waUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      window.alert("Permití ventanas emergentes para abrir WhatsApp");
      return;
    }

    try {
      setRegistrando(cobro.remito_id);
      await api(`/clientes/cobros-pendientes/${cobro.remito_id}/registrar`, {
        method: "POST"
      });
      loadCobros();
    } catch (error: any) {
      window.alert(error.message ?? "WhatsApp abrió, pero no se pudo registrar el recordatorio");
    } finally {
      setRegistrando(null);
    }
  };

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
  async function deleteClient(client: Client) {
    if (!confirmAction(`¿Eliminar definitivamente el cliente ${client.nombre}? Esta acción no se puede deshacer.`)) return;
    const typedName = window.prompt(`Para confirmar, escribí exactamente el nombre del cliente:\n${client.nombre}`);
    if (typedName !== client.nombre) {
      if (typedName !== null) window.alert("El nombre no coincide. No se eliminó el cliente.");
      return;
    }
    if (!confirmAction(`Última confirmación: ¿eliminar definitivamente ${client.nombre}?`)) return;
    try {
      await api(`/clientes/${client.id}`, { method: "DELETE" });
      setSelectedClient(null);
      await load(q, page);
    } catch (err: any) {
      window.alert(err.message ?? "No se pudo eliminar el cliente");
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
  async function importHistory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const pdfBase64 = importPdf ? await fileToBase64(importPdf) : undefined;
      const result = await api("/clientes/importar-historial", { method: "POST", body: JSON.stringify({ texto: importText, pdfBase64, actualizarSaldo: updateImportedBalance }) });
      setImportText("");
      setImportPdf(null);
      setImportFileKey((current) => current + 1);
      await load(q, 1);
      await openClient(result.cliente);
    } catch (err: any) {
      setError(err.message ?? "No se pudo importar el historial");
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
    <div className="tabs compact-tabs" style={{ gridColumn: "1 / -1", margin: "0 0 1rem 0" }}>
      <button type="button" className={activeTab === "list" ? "active" : ""} onClick={() => setActiveTab("list")}>Lista de Clientes</button>
      <button type="button" className={activeTab === "cobros" ? "active" : ""} onClick={() => setActiveTab("cobros")}>Cobros Pendientes</button>
    </div>

    {activeTab === "list" && <>
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
        <ClientDetail client={selectedClient} canWrite={canWrite} canEditBalance={canEditBalance} onUpdate={updateClient} onDelete={deleteClient} onClose={() => setSelectedClient(null)} onPdf={openClientRemitoPdf} />
      </div>}
      {canWrite && <section className="panel import-history-panel">
        <div className="detail-head"><div><h2>Importar historial anterior</h2><span>Subí el PDF anterior del cliente o pegá el texto copiado. Se guarda como historial y no modifica stock.</span></div></div>
        <form className="form import-history-form" onSubmit={importHistory}>
          <label className="field-label"><span>PDF del cliente</span><input key={importFileKey} type="file" accept="application/pdf,.pdf" onChange={(event) => setImportPdf(event.target.files?.[0] ?? null)} /></label>
          <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Opcional: pegá acá el informe del cliente copiado desde el PDF..." rows={7} required={!importPdf} />
          <label className="checkbox-line"><input type="checkbox" checked={updateImportedBalance} onChange={(event) => setUpdateImportedBalance(event.target.checked)} />Actualizar saldo pendiente con el saldo debido del informe</label>
          {error && <p className="error">{error}</p>}
          <button>{importPdf ? `Importar ${importPdf.name}` : "Importar historial"}</button>
        </form>
      </section>}
      {canWrite && <section className="panel"><h2>Nuevo cliente</h2><form className="form client-form" onSubmit={create}><ClientFields />{error && <p className="error">{error}</p>}<button>Crear cliente</button></form></section>}
    </>}

    {activeTab === "cobros" && <>
      <section className="client-overview">
        <Metric label="Facturas vencidas" value={String(filteredCobros.length)} />
        <Metric label="Total por cobrar" value={money(totalPendiente)} />
        <Metric label="Regla activa" value={`+${dias} días`} />
      </section>

      <section className="panel wide client-list-panel">
        <div className="detail-head">
          <div>
            <h2>Cobros Pendientes</h2>
            <span>Boletas con saldo pendiente ordenadas por antigüedad.</span>
          </div>
        </div>

        <div className="cobros-filters">
          <SearchBox
            q={cobrosSearch}
            setQ={setCobrosSearch}
            onSearch={(e) => { e?.preventDefault(); }}
            onClear={() => setCobrosSearch("")}
            placeholder="Buscar por cliente, teléfono o número de boleta..."
          />
          <div className="dias-input-container">
            <label htmlFor="dias-filtro">Días vencimiento:</label>
            <input
              id="dias-filtro"
              type="number"
              min="1"
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className="dias-input"
            />
          </div>
          <button type="button" onClick={loadCobros} disabled={cobrosLoading}>
            Actualizar
          </button>
        </div>

        {cobrosLoading ? (
          <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>Cargando cobros pendientes...</p>
        ) : filteredCobros.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>No hay cobros pendientes que coincidan con los filtros.</p>
        ) : (
          <div className="cobro-list">
            {filteredCobros.map((cobro) => (
              <div className="cobro-card" key={cobro.remito_id}>
                <div className="cobro-card-main">
                  <div className="cobro-card-header">
                    <h3>{cobro.cliente_nombre}</h3>
                    <span className="badge-vencido">{cobro.dias_vencida} días vencida</span>
                  </div>
                  <div className="cobro-meta">
                    {cobro.telefono && (
                      <span>
                        <Phone size={14} /> {cobro.telefono}
                      </span>
                    )}
                    <span>
                      Boleta #{cobro.numero}
                    </span>
                    <span>
                      Fecha: {new Date(cobro.fecha).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                  <div className="cobro-mensaje-preview">
                    {cobro.mensaje}
                  </div>
                  {cobro.ultima_notificacion_at && (
                    <span className="cobro-notif-time">
                      Último recordatorio registrado: {new Date(cobro.ultima_notificacion_at).toLocaleString("es-AR")}
                    </span>
                  )}
                </div>
                <div className="cobro-card-aside">
                  <div className="cobro-saldo-box">
                    <span>Saldo</span>
                    <strong>{money(cobro.saldo)}</strong>
                  </div>
                  <div className="cobro-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => copyMessage(cobro.remito_id, cobro)}
                    >
                      {copiedId === cobro.remito_id ? "¡Copiado!" : "Copiar"}
                    </button>
                    {cobro.telefono_whatsapp ? (
                      <button
                        type="button"
                        onClick={() => registrarYEnviar(cobro)}
                        disabled={registrando === cobro.remito_id}
                      >
                        {registrando === cobro.remito_id ? "Registrando..." : "WhatsApp"}
                      </button>
                    ) : (
                      <button type="button" disabled title="Sin teléfono válido para WhatsApp">
                        WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>}
  </div>;
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
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

function ClientDetail({ client, canWrite, canEditBalance, onUpdate, onDelete, onClose, onPdf }: { client: Client; canWrite: boolean; canEditBalance: boolean; onUpdate: (event: React.FormEvent<HTMLFormElement>) => void; onDelete: (client: Client) => void; onClose: () => void; onPdf: (row: any) => void }) {
  const [editing, setEditing] = useState(false);
  const remitos = client.remitos ?? [];
  const historialImportado = (client as any).historialImportado ?? [];
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
    <div className="client-remittances"><h3>Historial anterior importado</h3><span>Facturas viejas cargadas desde PDF. No descuentan stock ni cuentan como ventas nuevas.</span><div className="historical-list">{historialImportado.map((importacion: any) => <HistoricalImportCard importacion={importacion} key={importacion.id} />)}{!historialImportado.length && <p className="muted">Este cliente no tiene historial anterior importado.</p>}</div></div>
    <div className="client-remittances"><h3>Boletas del cliente</h3><span>Primero aparecen las que tienen saldo pendiente.</span><div className="client-remito-list">{remitoRows.map((row) => <ClientRemitoCard row={row} key={row.id} onPdf={onPdf} />)}{!remitoRows.length && <p className="muted">Este cliente todavía no tiene boletas.</p>}</div></div>
    {canWrite && <div className="client-edit-box"><button type="button" className="secondary" onClick={() => setEditing(true)}>Editar datos del cliente</button></div>}
    {canEditBalance && <div className="client-danger-zone"><div><strong>Eliminar definitivamente</strong><span>Solo se permite si el cliente no tiene boletas ni historial asociado.</span></div><button type="button" className="danger" onClick={() => onDelete(client)}>Eliminar cliente</button></div>}
    {editing && <ClientEditModal client={client} canEditBalance={canEditBalance} onUpdate={onUpdate} onClose={() => setEditing(false)} />}
  </section>;
}

function HistoricalImportCard({ importacion }: { importacion: any }) {
  const [open, setOpen] = useState(false);
  const facturas = importacion.facturas ?? [];
  return <article className="historical-card">
    <button type="button" className="historical-summary" onClick={() => setOpen(!open)}>
      <div><strong>{importacion.nombreOriginal}</strong><span>{new Date(importacion.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })} · {facturas.length} factura{facturas.length === 1 ? "" : "s"} importada{facturas.length === 1 ? "" : "s"}</span></div>
      <div className="historical-summary-values"><span>Total <strong>{money(importacion.total)}</strong></span><span>Pagado <strong>{money(importacion.pagado)}</strong></span><span>Saldo <strong>{money(importacion.saldo)}</strong></span></div>
      <span className="mini-chip">{open ? "Ocultar facturas" : "Ver facturas"}</span>
    </button>
    {open && <div className="historical-invoices">
      <div className="historical-invoice head"><strong>Nro</strong><strong>Fecha</strong><strong>Total</strong><strong>Pagado</strong></div>
      {facturas.map((factura: any) => <div className="historical-invoice" key={factura.id}><span>#{factura.numero}</span><span>{formatDate(factura.fecha)}</span><span>{money(factura.total)}</span><span>{money(factura.pagado)}</span></div>)}
      <div className="historical-total"><span>Total {money(importacion.total)}</span><span>Pagado {money(importacion.pagado)}</span><span>Saldo {money(importacion.saldo)}</span></div>
    </div>}
  </article>;
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
