import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, openPdfViewer, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";

export function CommercialsView({ api, isAdmin, canWrite }: { api: ReturnType<typeof useApi>; isAdmin: boolean; canWrite: boolean }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tab, setTab] = useState<"vendors" | "suppliers">("vendors");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorDetail, setVendorDetail] = useState<any | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [vendorModal, setVendorModal] = useState<"create" | "edit" | null>(null);
  const [supplierModal, setSupplierModal] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState("");
  const loadVendors = () => api("/vendedores?pageSize=100").then((d) => setVendors(d.items));
  const loadSuppliers = () => api("/proveedores?pageSize=100").then((d) => setSuppliers(d.items));
  useEffect(() => { loadVendors(); loadSuppliers(); }, []);
  async function openVendor(vendor: Vendor) {
    setError("");
    setVendorDetail(await api(`/vendedores/${vendor.id}`));
  }
  async function openVendorRemitoPdf(remito: any) {
    setError("");
    try {
      const blob = await api(`/remitos/${remito.id}/pdf`, { headers: { Accept: "application/pdf" } });
      openPdfViewer(blob, `Boleta #${remito.numero}`);
    } catch (err: any) {
      setError(err.message ?? "No se pudo abrir el PDF");
    }
  }
  async function createVendor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = payload(formEl);
    setError("");
    try {
      await api("/vendedores", { method: "POST", body: JSON.stringify({ nombre: form.nombre, porcentajeComision: Number(form.porcentajeComision) }) });
      formEl.reset();
      setVendorModal(null);
      await loadVendors();
    } catch (err: any) {
      setError(err.message ?? "No se pudo crear el vendedor");
    }
  }
  async function updateVendor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVendor) return;
    const form = payload(event.currentTarget);
    setError("");
    try {
      await api(`/vendedores/${selectedVendor.id}`, { method: "PATCH", body: JSON.stringify({ nombre: form.nombre, porcentajeComision: Number(form.porcentajeComision), activo: form.activo === "true" }) });
      setSelectedVendor(null);
      setVendorModal(null);
      await loadVendors();
    } catch (err: any) {
      setError(err.message ?? "No se pudo actualizar el vendedor");
    }
  }
  async function createSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = payload(formEl);
    setError("");
    try {
      await api("/proveedores", { method: "POST", body: JSON.stringify(supplierPayload(form)) });
      formEl.reset();
      setSupplierModal(null);
      await loadSuppliers();
    } catch (err: any) {
      setError(err.message ?? "No se pudo crear el proveedor");
    }
  }
  async function updateSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSupplier) return;
    const form = payload(event.currentTarget);
    setError("");
    try {
      await api(`/proveedores/${selectedSupplier.id}`, { method: "PATCH", body: JSON.stringify({ ...supplierPayload(form), activo: form.activo === "true" }) });
      setSelectedSupplier(null);
      setSupplierModal(null);
      await loadSuppliers();
    } catch (err: any) {
      setError(err.message ?? "No se pudo actualizar el proveedor");
    }
  }
  const activeCount = vendors.filter((vendor) => vendor.activo).length;
  const activeSuppliers = suppliers.filter((supplier) => supplier.activo).length;
  return <div className="client-page">
    <section className="panel vendor-panel wide">
      <div className="detail-head"><div><h2>Comerciales</h2><span>Vendedores para comisiones y proveedores para compras.</span></div>{tab === "vendors" ? <button type="button" onClick={() => { setError(""); setSelectedVendor(null); setVendorModal("create"); }}>Nuevo vendedor</button> : canWrite && <button type="button" onClick={() => { setError(""); setSelectedSupplier(null); setSupplierModal("create"); }}>Nuevo proveedor</button>}</div>
      <div className="tabs compact-tabs"><button type="button" className={tab === "vendors" ? "active" : ""} onClick={() => { setVendorDetail(null); setTab("vendors"); }}>Vendedores</button><button type="button" className={tab === "suppliers" ? "active" : ""} onClick={() => { setVendorDetail(null); setTab("suppliers"); }}>Proveedores</button></div>
      {tab === "vendors" && <>
        <div className="section-title"><h3>Vendedores</h3><span>{activeCount} activos · comisiones aplicadas en ventas.</span></div>
        <div className="vendor-list vendor-list-grid">{vendors.map((vendor) => <button type="button" className="vendor-card vendor-stats-card" key={vendor.id} onClick={() => openVendor(vendor)}><div><strong>{vendor.nombre}</strong><span>{vendor.activo ? "Activo" : "Inactivo"} · {Number(vendor.porcentajeComision)}% comisión</span></div><div className="vendor-stats"><span>Ventas</span><strong>{money(vendor.ventasTotal ?? 0)}</strong><small>{vendor.boletasTotal ?? 0} boleta{(vendor.boletasTotal ?? 0) === 1 ? "" : "s"}</small><small>Comisión {money(vendor.comisionTotal ?? 0)}</small></div></button>)}{!vendors.length && <p className="muted">No hay vendedores cargados.</p>}</div>
      </>}
      {tab === "suppliers" && <>
        <div className="section-title"><h3>Proveedores</h3><span>{activeSuppliers} activos · disponibles al cargar compras.</span></div>
        <div className="vendor-list supplier-list-grid">{suppliers.map((supplier) => <button type="button" className="vendor-card supplier-card" key={supplier.id} onClick={() => { if (!isAdmin) return; setError(""); setSelectedSupplier(supplier); setSupplierModal("edit"); }}><div><strong>{supplier.nombre}</strong><span>{supplier.contacto ?? "Sin contacto"} · {supplier.telefono ?? "sin teléfono"}</span><small>{supplier.email ?? supplier.cuit ?? (supplier.activo ? "Activo" : "Inactivo")}</small></div><span className={`status-chip ${supplier.activo ? "activo" : "cancelado"}`}>{supplier.activo ? "Activo" : "Inactivo"}</span></button>)}{!suppliers.length && <p className="muted">No hay proveedores cargados.</p>}</div>
      </>}
    </section>
    {vendorModal === "create" && <VendorModal title="Nuevo vendedor" onClose={() => setVendorModal(null)} onSubmit={createVendor} error={error} />}
    {vendorDetail && <VendorDetail vendor={vendorDetail} onClose={() => setVendorDetail(null)} onEdit={() => { setSelectedVendor(vendorDetail); setVendorModal("edit"); }} onPdf={openVendorRemitoPdf} />}
    {vendorModal === "edit" && selectedVendor && <VendorModal title="Editar vendedor" vendor={selectedVendor} onClose={() => { setVendorModal(null); setSelectedVendor(null); }} onSubmit={updateVendor} error={error} />}
    {supplierModal === "create" && <SupplierModal title="Nuevo proveedor" onClose={() => setSupplierModal(null)} onSubmit={createSupplier} error={error} />}
    {supplierModal === "edit" && selectedSupplier && <SupplierModal title="Editar proveedor" supplier={selectedSupplier} canEditStatus={isAdmin} onClose={() => { setSupplierModal(null); setSelectedSupplier(null); }} onSubmit={updateSupplier} error={error} />}
  </div>;
}

function supplierPayload(form: Record<string, FormDataEntryValue>) {
  return {
    nombre: form.nombre,
    contacto: form.contacto || null,
    telefono: form.telefono || null,
    email: form.email || null,
    cuit: form.cuit || null,
    direccion: form.direccion || null,
    observaciones: form.observaciones || null
  };
}

function VendorDetail({ vendor, onClose, onEdit, onPdf }: { vendor: any; onClose: () => void; onEdit: () => void; onPdf: (remito: any) => void }) {
  const remitos = vendor.remitos ?? [];
  const clientes = Array.from(new Set(remitos.map((remito: any) => remito.cliente?.nombre).filter(Boolean)));
  const [salesSearch, setSalesSearch] = useState("");
  const [salesPage, setSalesPage] = useState(1);
  const pageSize = 6;
  const filteredRemitos = useMemo(() => {
    const term = salesSearch.trim().toLowerCase();
    if (!term) return remitos;
    return remitos.filter((remito: any) => {
      const items = (remito.items ?? []).map((item: any) => item.nombreProducto).join(" ");
      return [
        `boleta ${remito.numero}`,
        remito.numero,
        remito.cliente?.nombre,
        remito.pagoEstado,
        formatDate(remito.fecha),
        items
      ].filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [remitos, salesSearch]);
  const totalSalesPages = Math.max(1, Math.ceil(filteredRemitos.length / pageSize));
  const visibleRemitos = filteredRemitos.slice((salesPage - 1) * pageSize, salesPage * pageSize);
  useEffect(() => {
    setSalesPage(1);
  }, [salesSearch, vendor.id]);

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Detalle de ${vendor.nombre}`}>
    <section className="vendor-detail vendor-detail-modal">
      <div className="detail-head">
        <div><h3>{vendor.nombre}</h3><span>{vendor.activo ? "Activo" : "Inactivo"} · {Number(vendor.porcentajeComision)}% comisión</span></div>
        <div className="table-actions"><button type="button" className="secondary" onClick={onEdit}>Editar</button><button type="button" className="icon-button" onClick={onClose} title="Cerrar detalle"><X size={18} /></button></div>
      </div>
      <div className="detail-grid">
        <Metric label="Total vendido" value={money(vendor.ventasTotal ?? 0)} />
        <Metric label="Comisión" value={money(vendor.comisionTotal ?? 0)} />
        <Metric label="Boletas" value={String(vendor.boletasTotal ?? 0)} />
        <Metric label="Clientes" value={String(vendor.clientesTotal ?? clientes.length)} />
      </div>
      <div className="vendor-detail-grid">
        <div className="vendor-sales-list">
          <div className="vendor-sales-head">
            <div className="section-title"><h3>Ventas realizadas</h3><span>{filteredRemitos.length} de {remitos.length} boletas activas.</span></div>
            <label className="search-field compact-search">
              <Search size={16} />
              <input value={salesSearch} onChange={(event) => setSalesSearch(event.target.value)} placeholder="Buscar boleta, cliente o producto" />
            </label>
          </div>
          <div className="vendor-sales-scroll">
            {visibleRemitos.map((remito: any) => <div className="vendor-sale-row" key={remito.id}><div><strong>Boleta #{remito.numero}</strong><span>{formatDate(remito.fecha)} · {remito.cliente?.nombre ?? "Cliente"}</span><small>{(remito.items ?? []).map((item: any) => `${item.cantidad} x ${item.nombreProducto}`).join(" · ")}</small></div><div className="vendor-sale-side"><strong>{money(remito.total)}</strong><span>{remito.pagoEstado}</span><button type="button" className="secondary tiny-action" onClick={() => onPdf(remito)}>PDF</button></div></div>)}
            {!remitos.length && <p className="muted">Este vendedor todavía no tiene ventas activas.</p>}
            {!!remitos.length && !filteredRemitos.length && <p className="muted">No hay ventas que coincidan con la búsqueda.</p>}
          </div>
          {filteredRemitos.length > pageSize && <div className="pager">
            <button type="button" className="secondary" onClick={() => setSalesPage((page) => Math.max(1, page - 1))} disabled={salesPage === 1}>Anterior</button>
            <span>Página {salesPage} de {totalSalesPages}</span>
            <button type="button" className="secondary" onClick={() => setSalesPage((page) => Math.min(totalSalesPages, page + 1))} disabled={salesPage === totalSalesPages}>Siguiente</button>
          </div>}
        </div>
        <div className="vendor-client-list">
          <div className="section-title"><h3>Clientes atendidos</h3></div>
          {clientes.map((cliente) => <span className="mini-chip" key={String(cliente)}>{String(cliente)}</span>)}
          {!clientes.length && <p className="muted">Sin clientes todavía.</p>}
        </div>
      </div>
    </section>
  </div>;
}

function VendorModal({ title, vendor, onClose, onSubmit, error }: { title: string; vendor?: Vendor; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; error?: string }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
    <div className="form-modal">
      <div className="selector-head">
        <div><h3>{title}</h3><span>{vendor ? "Actualizá la comisión o el estado." : "Cargá el nombre y porcentaje de comisión."}</span></div>
        <button type="button" className="icon-button" onClick={onClose} title="Cerrar"><X size={18} /></button>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <input name="nombre" defaultValue={vendor?.nombre ?? ""} placeholder="Nombre" required autoFocus />
        <input name="porcentajeComision" type="number" step="0.01" min="0" max="100" defaultValue={vendor ? Number(vendor.porcentajeComision) : undefined} placeholder="% comisión" required />
        {vendor && <select name="activo" defaultValue={String(vendor.activo)}><option value="true">Activo</option><option value="false">Inactivo</option></select>}
        {error && <p className="error">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button>{vendor ? "Guardar cambios" : "Crear vendedor"}</button></div>
      </form>
    </div>
  </div>;
}

function SupplierModal({ title, supplier, canEditStatus = true, onClose, onSubmit, error }: { title: string; supplier?: Supplier; canEditStatus?: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; error?: string }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
    <div className="form-modal supplier-modal">
      <div className="selector-head">
        <div><h3>{title}</h3><span>{supplier ? "Actualizá los datos del proveedor." : "Cargá los datos para usarlo en compras."}</span></div>
        <button type="button" className="icon-button" onClick={onClose} title="Cerrar"><X size={18} /></button>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <div className="form-grid">
          <input name="nombre" defaultValue={supplier?.nombre ?? ""} placeholder="Nombre del proveedor" required autoFocus />
          <input name="contacto" defaultValue={supplier?.contacto ?? ""} placeholder="Persona de contacto" />
          <input name="telefono" defaultValue={supplier?.telefono ?? ""} placeholder="Teléfono" />
          <input name="email" type="email" defaultValue={supplier?.email ?? ""} placeholder="Email" />
          <input name="cuit" defaultValue={supplier?.cuit ?? ""} placeholder="CUIT" />
          <input name="direccion" defaultValue={supplier?.direccion ?? ""} placeholder="Dirección" />
        </div>
        <textarea name="observaciones" defaultValue={supplier?.observaciones ?? ""} placeholder="Observaciones" rows={3} />
        {supplier && canEditStatus && <select name="activo" defaultValue={String(supplier.activo)}><option value="true">Activo</option><option value="false">Inactivo</option></select>}
        {supplier && !canEditStatus && <input type="hidden" name="activo" value={String(supplier.activo)} />}
        {error && <p className="error">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button>{supplier ? "Guardar cambios" : "Crear proveedor"}</button></div>
      </form>
    </div>
  </div>;
}
