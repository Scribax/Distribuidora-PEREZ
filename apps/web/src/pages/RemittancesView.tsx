import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, openPdfViewer, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";

const REMITOS_PAGE_SIZE = 10;

export function RemittancesView({ api, canWrite, isAdmin }: { api: ReturnType<typeof useApi>; canWrite: boolean; isAdmin: boolean }) {
  const [remitos, setRemitos] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalRemitos, setTotalRemitos] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [remitoItems, setRemitoItems] = useState<LineItem[]>([]);
  const [editItems, setEditItems] = useState<LineItem[]>([]);
  const [priceList, setPriceList] = useState<"MAYORISTA" | "MINORISTA">("MAYORISTA");
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [builderProductId, setBuilderProductId] = useState("");
  const [editProductId, setEditProductId] = useState("");
  const [filters, setFilters] = useState({ numero: "", clienteId: "", vendedorId: "", estado: "", pagoEstado: "", fechaDesde: "", fechaHasta: "" });
  const [error, setError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const load = (next = filters, nextPage = page): Promise<void> => Promise.all([
    api(`/remitos?${qs({ ...next, page: nextPage, pageSize: REMITOS_PAGE_SIZE })}`),
    api("/productos?estado=ACTIVO&pageSize=1000"),
    api("/clientes?pageSize=1000"),
    api("/vendedores?pageSize=1000")
  ]).then(([r, p, c, v]) => {
    const resultTotal = r.total ?? r.items.length;
    if (!r.items.length && resultTotal > 0 && nextPage > 1) return load(next, nextPage - 1);
    setRemitos(r.items);
    setTotalRemitos(resultTotal);
    setPage(r.page ?? nextPage);
    setProducts(p.items);
    setClients(c.items);
    setVendors(v.items);
  });
  useEffect(() => { load(); }, []);
  async function openRemito(row: any) {
    setEditSaved(false);
    const full = await api(`/remitos/${row.id}`);
    setSelected(full);
    setEditItems(remitoItemsFrom(full.items ?? [], products));
  }
  function addBuilderItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = payload(event.currentTarget);
    addLine(products, form, setRemitoItems);
    setBuilderProductId("");
    event.currentTarget.reset();
  }
  function addEditItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = payload(event.currentTarget);
    addLine(products, form, setEditItems);
    setEditProductId("");
    event.currentTarget.reset();
  }
  async function openPdf(remito: any) {
    setError("");
    try {
      const blob = await api(`/remitos/${remito.id}/pdf`, { headers: { Accept: "application/pdf" } });
      openPdfViewer(blob, `Boleta #${remito.numero}`);
    } catch (err: any) {
      setError(err.message ?? "No se pudo abrir el PDF");
    }
  }
  async function cancelRemito(row: any) {
    if (!confirmAction(`¿Anular la boleta #${row.numero}? Va a quedar como cancelada, se restaura el stock y no se puede deshacer.`)) return;
    try {
      await api(`/remitos/${row.id}/cancelar`, { method: "POST" });
      setSelected(null);
      await load(filters, page);
    } catch (err: any) {
      setError(err.message ?? "No se pudo cancelar la boleta");
    }
  }
  async function deleteRemito(row: any) {
    if (!confirmAction(`¿Eliminar definitivamente la boleta #${row.numero}? No quedará en el historial. Si estaba activa, se restaurará stock y saldo.`)) return;
    try {
      await api(`/remitos/${row.id}`, { method: "DELETE" });
      setSelected((current: any) => current?.id === row.id ? null : current);
      await load(filters, page);
    } catch (err: any) {
      setError(err.message ?? "No se pudo eliminar la boleta");
    }
  }
  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = payload(event.currentTarget);
    setSavingEdit(true);
    setEditSaved(false);
    setError("");
    try {
      const updated = await api(`/remitos/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({
          vendedorId: form.vendedorId || null,
          pagoEstado: form.pagoEstado,
          metodoPago: form.metodoPago || null,
          montoPagado: Number(form.montoPagado ?? 0),
          descuentoPorcentaje: Number(form.descuentoPorcentaje ?? selected.descuentoPorcentaje ?? 0),
          items: editItems.length ? editItems.map((item) => ({ productoId: item.product.id, cantidad: item.cantidad })) : undefined
        })
      });
      setSelected(updated);
      setEditSaved(true);
      await load(filters, page);
    } catch (err: any) {
      setError(err.message ?? "No se pudo editar la boleta");
    } finally {
      setSavingEdit(false);
    }
  }
  async function markAsPaid() {
    if (!selected) return;
    try {
      const updated = await api(`/remitos/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({
          pagoEstado: "PAGADA",
          montoPagado: Number(selected.total),
          metodoPago: selected.metodoPago ?? null
        })
      });
      setSelected(updated);
      await load(filters, page);
    } catch (err: any) {
      setError(err.message ?? "No se pudo marcar como pagada");
    }
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = payload(formEl);
    setError("");
    if (!remitoItems.length) return setError("Agregá al menos un producto a la boleta.");
    try {
      await api("/remitos", {
        method: "POST",
        body: JSON.stringify({
          clienteId: form.clienteId,
          vendedorId: form.vendedorId || null,
          listaPrecios: priceList,
          pagoEstado: form.pagoEstado,
          metodoPago: form.metodoPago || null,
          montoPagado: Number(form.montoPagado ?? 0),
          descuentoPorcentaje: Number(form.descuentoPorcentaje ?? 0),
          fecha: form.fecha,
          items: remitoItems.map((item) => ({ productoId: item.product.id, cantidad: item.cantidad }))
        })
      });
      formEl.reset();
      setRemitoItems([]);
      setDescuentoPorcentaje(0);
      setSelectedClientId("");
      setSelectedVendorId("");
      await load(filters, 1);
    } catch (err: any) {
      setError(err.message ?? "No se pudo crear la boleta");
    }
  }
  const activeClients = clients.filter((x) => x.activo);
  const activeVendors = vendors.filter((x) => x.activo);
  const subtotal = remitoItems.reduce((sum, item) => sum + item.cantidad * itemPrice(item.product, priceList), 0);
  const total = subtotal * (1 - Math.min(Math.max(descuentoPorcentaje, 0), 100) / 100);
  const remitoRows = remitos.map(formatRemitoRow);
  const totalPages = Math.max(1, Math.ceil(totalRemitos / REMITOS_PAGE_SIZE));
  const firstVisible = totalRemitos === 0 ? 0 : (page - 1) * REMITOS_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * REMITOS_PAGE_SIZE, totalRemitos);
  const goToPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(safePage);
    load(filters, safePage);
  };
  const totals = remitos.reduce((acc, remito) => {
    if (remito.estado === "ACTIVO") {
      acc.total += Number(remito.total);
      acc.paid += remito.pagoEstado === "PAGADA" ? Number(remito.total) : Number(remito.montoPagado ?? 0);
      acc.pending += remitoPending(remito);
    }
    return acc;
  }, { total: 0, paid: 0, pending: 0 });
  return <div className="remitos-layout">
    <section className="sales-board">
      <div className="sales-summary">
        <Metric label="Boletas encontradas" value={String(totalRemitos)} />
        <Metric label="Total de esta página" value={money(totals.total)} />
        <Metric label="Cobrado en página" value={money(totals.paid)} />
        <Metric label="Pendiente en página" value={money(Math.max(totals.pending, 0))} />
      </div>
      <section className="panel sales-list-panel">
        <div className="detail-head sales-head"><div><h2>Boletas emitidas</h2><span>Buscá, revisá estado y abrí el detalle sin pelearte con una tabla enorme.</span></div>{canWrite && <button type="button" onClick={() => document.getElementById("crear-boleta")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Crear boleta</button>}</div>
        <form className="filters sales-filters" onSubmit={(e) => { e.preventDefault(); setPage(1); load(filters, 1); }}>
          <input value={filters.numero} onChange={(e) => setFilters({ ...filters, numero: e.target.value })} placeholder="Nro" />
          <EntityPicker items={clients} value={filters.clienteId} onChange={(value) => setFilters({ ...filters, clienteId: value })} title="Elegir cliente" placeholder="Todos los clientes" searchPlaceholder="Buscar cliente" getLabel={(client) => client.nombre} getMeta={(client) => `${client.direccion ?? "Sin dirección"} · saldo ${money(client.saldoPendiente)}`} />
          <EntityPicker items={vendors} value={filters.vendedorId} onChange={(value) => setFilters({ ...filters, vendedorId: value })} title="Elegir vendedor" placeholder="Todos los vendedores" searchPlaceholder="Buscar vendedor" getLabel={(vendor) => vendor.nombre} getMeta={(vendor) => `${Number(vendor.porcentajeComision)}% comisión`} />
          <select value={filters.estado} onChange={(e) => setFilters({ ...filters, estado: e.target.value })}><option value="">Todos los estados</option><option value="ACTIVO">Activos</option><option value="CANCELADO">Cancelados</option></select>
          <select value={filters.pagoEstado} onChange={(e) => setFilters({ ...filters, pagoEstado: e.target.value })}><option value="">Todos los pagos</option><option value="PENDIENTE">Pendiente</option><option value="PARCIAL">Parcial</option><option value="PAGADA">Pagada</option></select>
          <input type="date" value={filters.fechaDesde} onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })} />
          <input type="date" value={filters.fechaHasta} onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })} />
          <button>Filtrar</button>
        </form>
        <div className="sales-list-toolbar">
          <span>{firstVisible}-{lastVisible} de {totalRemitos} boletas</span>
          <div className="pager compact-pager">
            <button type="button" className="secondary" onClick={() => goToPage(page - 1)} disabled={page === 1}>Anterior</button>
            <span>Página {page} de {totalPages}</span>
            <button type="button" className="secondary" onClick={() => goToPage(page + 1)} disabled={page === totalPages}>Siguiente</button>
          </div>
        </div>
        <div className="sales-list">{remitoRows.map((row) => <SaleCard key={row.id} row={row} onOpen={openRemito} onPdf={openPdf} onCancel={canWrite && row.estado === "ACTIVO" ? cancelRemito : undefined} onDelete={isAdmin ? deleteRemito : undefined} />)}{!remitoRows.length && <p className="muted">No hay boletas con estos filtros.</p>}</div>
      </section>
    </section>
    {selected && <div className="modal-backdrop remito-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Boleta ${selected.numero}`} onClick={() => setSelected(null)}>
      <RemitoDetail selected={selected} canWrite={canWrite} activeVendors={activeVendors} editItems={editItems} products={products} editProductId={editProductId} savingEdit={savingEdit} editSaved={editSaved} onClose={() => setSelected(null)} onSaveEdit={saveEdit} onMarkPaid={markAsPaid} onEditProductChange={setEditProductId} onEditItemsChange={setEditItems} onAddEditItem={addEditItem} />
    </div>}
    {canWrite && <section className="panel remito-builder" id="crear-boleta">
      <h2>Crear boleta</h2>
      <form className="form" onSubmit={create}>
        <div className="step-block"><span className="step-badge">1</span><div className="step-content"><div className="step-title"><strong>Cliente y lista</strong><span>Elegí a quién se emite la boleta.</span></div><div className="form-grid"><EntityPicker items={activeClients} value={selectedClientId} onChange={setSelectedClientId} name="clienteId" title="Elegir cliente" placeholder="Elegir cliente" searchPlaceholder="Buscar por nombre, dirección o saldo" getLabel={(client) => client.nombre} getMeta={(client) => `${client.direccion ?? "Sin dirección"} · saldo ${money(client.saldoPendiente)}`} required /><EntityPicker items={activeVendors} value={selectedVendorId} onChange={setSelectedVendorId} name="vendedorId" title="Elegir vendedor" placeholder="Sin vendedor" searchPlaceholder="Buscar vendedor" getLabel={(vendor) => vendor.nombre} getMeta={(vendor) => `${Number(vendor.porcentajeComision)}% comisión`} /><select value={priceList} onChange={(e) => setPriceList(e.target.value as "MAYORISTA" | "MINORISTA")}><option value="MAYORISTA">Lista mayorista</option><option value="MINORISTA">Lista minorista</option></select><input name="fecha" type="date" defaultValue={dateInput()} required /></div></div></div>
        <div className="step-block"><span className="step-badge">2</span><div className="step-content"><div className="step-title"><strong>Productos</strong><span>Buscá por código, nombre o rubro.</span></div><div className="add-line"><ProductPicker products={products} name="productoId" form="add-remito-product" value={builderProductId} onChange={setBuilderProductId} /><input name="cantidad" form="add-remito-product" type="number" min="1" placeholder="Cantidad" required /><button type="submit" form="add-remito-product">Agregar</button></div></div></div>
        <div className="step-block"><span className="step-badge">3</span><div className="step-content"><div className="step-title"><strong>Pago y descuento</strong><span>Completá esta parte solo si querés registrar cobro o aplicar descuento.</span></div><div className="payment-grid"><label className="field-card"><span>Estado del pago</span><select name="pagoEstado" defaultValue="PENDIENTE"><option value="PENDIENTE">Pendiente</option><option value="PARCIAL">Parcial</option><option value="PAGADA">Pagada</option></select><small>Cómo queda la boleta para seguimiento.</small></label><label className="field-card"><span>Método de pago</span><select name="metodoPago"><option value="">Sin método</option><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="TARJETA">Tarjeta</option><option value="CHEQUE">Cheque</option><option value="OTRO">Otro</option></select><small>Opcional si todavía no pagó.</small></label><label className="field-card"><span>Monto abonado</span><input name="montoPagado" type="number" step="0.01" min="0" defaultValue="0" placeholder="Ej: 5000" /><small>Lo que entregó el cliente ahora.</small></label><label className="field-card"><span>Descuento</span><input name="descuentoPorcentaje" type="number" step="0.01" min="0" max="100" value={descuentoPorcentaje} onChange={(e) => setDescuentoPorcentaje(Number(e.target.value || 0))} placeholder="Ej: 10" /><small>Porcentaje sobre el subtotal.</small></label></div></div></div>
        <div className="step-block"><span className="step-badge">4</span><div className="step-content"><div className="step-title"><strong>Resumen</strong><span>Revisá los productos antes de crearla.</span></div><div className="stack"><ItemList items={remitoItems} mode="remito" priceList={priceList} onRemove={(id) => setRemitoItems((current) => current.filter((item) => item.product.id !== id))} /><Metric label="Subtotal" value={money(subtotal)} />{descuentoPorcentaje > 0 && <Metric label={`Descuento ${descuentoPorcentaje}%`} value={`-${money(subtotal - total)}`} />}<Metric label="Total boleta" value={money(total)} />{error && <p className="error">{error}</p>}<button>Crear boleta</button></div></div></div>
      </form>
      <form id="add-remito-product" onSubmit={addBuilderItem} />
    </section>}
  </div>;
}

function addLine(products: Product[], form: Record<string, FormDataEntryValue>, setter: React.Dispatch<React.SetStateAction<LineItem[]>>) {
  const product = products.find((p) => p.id === form.productoId);
  const cantidad = Number(form.cantidad);
  if (!product || cantidad <= 0) return;
  setter((current) => {
    const existing = current.find((item) => item.product.id === product.id);
    if (existing) return current.map((item) => item.product.id === product.id ? { ...item, cantidad: item.cantidad + cantidad } : item);
    return [...current, { product, cantidad }];
  });
}

function remitoItemsFrom(items: any[], products: Product[]) {
  return items.map((item) => {
    const product = products.find((p) => p.id === item.productoId) ?? { id: item.productoId, codigoInterno: item.codigoProducto, nombre: item.nombreProducto, stockActual: 0, stockMinimo: 0, precioMayorista: item.precioUnitario, precioMinorista: item.precioUnitario, costo: "0", activo: true };
    return { product, cantidad: item.cantidad };
  });
}

function SaleCard({ row, onOpen, onPdf, onCancel, onDelete }: { row: any; onOpen: (row: any) => void; onPdf: (row: any) => void; onCancel?: (row: any) => void; onDelete?: (row: any) => void }) {
  const pending = remitoPending(row);
  const paid = row.pagoEstado === "PAGADA" ? Number(row.total) : Number(row.montoPagado ?? 0);
  return <article className="sale-card">
    <button type="button" className="sale-main" onClick={() => onOpen(row)}>
      <div className="sale-title"><strong>Boleta #{row.numero}</strong><span>{row.fechaCorta}</span></div>
      <div className="sale-client"><strong>{row.cliente?.nombre ?? "Cliente"}</strong><span>{row.vendedor?.nombre ?? "Sin vendedor"}</span></div>
      <div className="sale-badges"><span className={`status-chip ${String(row.pagoEstado).toLowerCase()}`}>{row.pagoEstado}</span><span className={`status-chip ${String(row.estado).toLowerCase()}`}>{row.estado}</span></div>
      <div className="sale-money"><strong>{row.totalFmt}</strong><span>Pagado {money(paid)} · pendiente {money(pending)}</span></div>
    </button>
    <div className="sale-actions"><button type="button" className="secondary" onClick={() => onPdf(row)}>PDF</button>{onCancel && <button type="button" className="secondary" onClick={() => onCancel(row)}>Anular</button>}{onDelete && <button type="button" className="danger" onClick={() => onDelete(row)}>Eliminar</button>}</div>
  </article>;
}

function RemitoDetail({ selected, canWrite, activeVendors, editItems, products, editProductId, savingEdit, editSaved, onClose, onSaveEdit, onMarkPaid, onEditProductChange, onEditItemsChange, onAddEditItem }: { selected: any; canWrite: boolean; activeVendors: Vendor[]; editItems: LineItem[]; products: Product[]; editProductId: string; savingEdit: boolean; editSaved: boolean; onClose: () => void; onSaveEdit: (event: React.FormEvent<HTMLFormElement>) => void; onMarkPaid: () => void; onEditProductChange: (value: string) => void; onEditItemsChange: React.Dispatch<React.SetStateAction<LineItem[]>>; onAddEditItem: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const pending = remitoPending(selected);
  const paid = selected.pagoEstado === "PAGADA" ? Number(selected.total) : Number(selected.montoPagado ?? 0);
  const commission = selected.vendedor ? Number(selected.total) * Number(selected.vendedor.porcentajeComision) / 100 : 0;
  const isPaid = selected.pagoEstado === "PAGADA" || pending <= 0;
  const itemCount = selected.items?.reduce((sum: number, item: any) => sum + Number(item.cantidad ?? 0), 0) ?? 0;
  const paymentLabel = selected.metodoPago ? String(selected.metodoPago).replaceAll("_", " ") : "Sin método";
  return <section className="panel detail-panel remito-detail remito-detail-modal" onClick={(event) => event.stopPropagation()}>
    <div className="detail-head remito-detail-head">
      <div><h2>Boleta #{selected.numero}</h2><span>{selected.cliente?.nombre ?? "Cliente"} · {formatDate(selected.fecha)}</span></div>
      <button type="button" className="icon-button" onClick={onClose} title="Cerrar detalle"><X size={18} /></button>
    </div>
    <div className={`remito-focus-card ${isPaid ? "paid" : "pending"}`}>
      <div>
        <span className="eyebrow">{isPaid ? "Cobro cerrado" : "Saldo a cobrar"}</span>
        <strong>{isPaid ? money(selected.total) : money(pending)}</strong>
        <small>{isPaid ? `Pagada ${paymentLabel !== "Sin método" ? `por ${paymentLabel.toLowerCase()}` : ""}` : `Pagado hasta ahora: ${money(paid)}`}</small>
      </div>
      <div className="remito-focus-actions">
        <span className={`status-chip ${String(selected.pagoEstado).toLowerCase()}`}>{selected.pagoEstado}</span>
        <span className={`status-chip ${String(selected.estado).toLowerCase()}`}>{selected.estado}</span>
        {canWrite && selected.estado === "ACTIVO" && !isPaid && <button type="button" onClick={onMarkPaid}>Registrar como pagada</button>}
      </div>
    </div>
    <div className="remito-summary-list">
      <div><span>Vendedor</span><strong>{selected.vendedor?.nombre ?? "Sin vendedor"}</strong></div>
      <div><span>Método</span><strong>{paymentLabel}</strong></div>
      <div><span>Productos</span><strong>{itemCount} u.</strong></div>
      <div><span>Comisión</span><strong>{money(commission)}</strong></div>
    </div>
    <div className="remito-products">
      <div className="section-title">
        <h3>Productos vendidos</h3>
        <span>Total {money(selected.total)}</span>
      </div>
      <div className="line-items">{(selected.items ?? []).map((item: any) => <div className="line-item" key={item.id ?? item.productoId}><div><strong>{item.nombreProducto}</strong><span>{item.codigoProducto} · cant. {item.cantidad} · unit. {money(item.precioUnitario)}</span></div><strong>{money(item.subtotal)}</strong></div>)}</div>
    </div>
    {canWrite && selected.estado === "ACTIVO" && <div className="client-edit-box">
      <button type="button" className="secondary compact-toggle" onClick={() => setEditOpen(true)}>Editar cobro o productos</button>
    </div>}
    {editOpen && <RemitoEditModal selected={selected} activeVendors={activeVendors} editItems={editItems} products={products} editProductId={editProductId} savingEdit={savingEdit} editSaved={editSaved} onClose={() => setEditOpen(false)} onSaveEdit={onSaveEdit} onEditProductChange={onEditProductChange} onEditItemsChange={onEditItemsChange} onAddEditItem={onAddEditItem} />}
  </section>;
}

function RemitoEditModal({ selected, activeVendors, editItems, products, editProductId, savingEdit, editSaved, onClose, onSaveEdit, onEditProductChange, onEditItemsChange, onAddEditItem }: { selected: any; activeVendors: Vendor[]; editItems: LineItem[]; products: Product[]; editProductId: string; savingEdit: boolean; editSaved: boolean; onClose: () => void; onSaveEdit: (event: React.FormEvent<HTMLFormElement>) => void; onEditProductChange: (value: string) => void; onEditItemsChange: React.Dispatch<React.SetStateAction<LineItem[]>>; onAddEditItem: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const subtotal = editItems.reduce((sum, item) => sum + item.cantidad * itemPrice(item.product, selected.listaPrecios), 0);
  return <div className="modal-backdrop remito-edit-backdrop" role="dialog" aria-modal="true" aria-label={`Editar boleta ${selected.numero}`} onClick={onClose}>
    <section className="remito-edit-modal" onClick={(event) => event.stopPropagation()}>
      <div className="detail-head remito-detail-head">
        <div><h2>Editar boleta #{selected.numero}</h2><span>{selected.cliente?.nombre ?? "Cliente"} · {formatDate(selected.fecha)}</span></div>
        <button type="button" className="icon-button" onClick={onClose} title="Cerrar edición"><X size={18} /></button>
      </div>
      <form className="form remito-edit-form" onSubmit={onSaveEdit}>
        <fieldset disabled={savingEdit}>
          <div className="payment-grid remito-edit-payment">
            <label className="field-card"><span>Vendedor</span><select name="vendedorId" defaultValue={selected.vendedorId ?? ""}><option value="">Sin vendedor</option>{activeVendors.map((v) => <option value={v.id} key={v.id}>{v.nombre} · {Number(v.porcentajeComision)}%</option>)}</select><small>Para calcular comisión.</small></label>
            <label className="field-card"><span>Estado del pago</span><select name="pagoEstado" defaultValue={selected.pagoEstado}><option value="PENDIENTE">Pendiente</option><option value="PARCIAL">Parcial</option><option value="PAGADA">Pagada</option></select><small>Seguimiento de deuda.</small></label>
            <label className="field-card"><span>Método</span><select name="metodoPago" defaultValue={selected.metodoPago ?? ""}><option value="">Sin método</option><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="TARJETA">Tarjeta</option><option value="CHEQUE">Cheque</option><option value="OTRO">Otro</option></select><small>Opcional.</small></label>
            <label className="field-card"><span>Monto pagado</span><input name="montoPagado" type="number" step="0.01" min="0" defaultValue={Number(selected.montoPagado)} /><small>Total: {money(selected.total)}</small></label>
            <label className="field-card"><span>Descuento</span><input name="descuentoPorcentaje" type="number" step="0.01" min="0" max="100" defaultValue={Number(selected.descuentoPorcentaje ?? 0)} /><small>Porcentaje.</small></label>
          </div>
          <div className="remito-edit-products">
            <div className="section-title"><h3>Productos</h3><span>Nuevo subtotal {money(subtotal)}</span></div>
            <ItemList items={editItems} mode="remito" priceList={selected.listaPrecios} onRemove={(id) => onEditItemsChange((current) => current.filter((item) => item.product.id !== id))} />
            <div className="add-line"><ProductPicker products={products} name="productoId" form="edit-remito-product" value={editProductId} onChange={onEditProductChange} /><input name="cantidad" form="edit-remito-product" type="number" min="1" placeholder="Cantidad" required /><button type="submit" form="edit-remito-product">Agregar</button></div>
          </div>
          {editSaved && <p className="success">Cambios guardados correctamente.</p>}
          <div className="modal-actions remito-edit-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
            <button disabled={savingEdit}>{savingEdit ? "Guardando cambios..." : "Guardar cambios"}</button>
          </div>
        </fieldset>
      </form>
      <form id="edit-remito-product" onSubmit={onAddEditItem} />
    </section>
  </div>;
}
