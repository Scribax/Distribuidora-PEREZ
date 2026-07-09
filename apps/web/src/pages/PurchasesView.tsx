import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, FilterPanel, ItemList, ProductPicker } from "../components/pickers";

export function PurchasesView({ api, canWrite, isAdmin }: { api: ReturnType<typeof useApi>; canWrite: boolean; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [purchaseItems, setPurchaseItems] = useState<LineItem[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [filters, setFilters] = useState({ proveedor: "", productoId: "", fechaDesde: "", fechaHasta: "" });
  const [error, setError] = useState("");
  const load = (next = filters) => Promise.all([
    api(`/compras?${qs({ ...next, pageSize: 100 })}`),
    api("/productos?estado=ACTIVO&pageSize=1000"),
    api("/proveedores?pageSize=1000")
  ]).then(([c, p, s]) => { setItems(c.items); setProducts(p.items); setSuppliers(s.items); });
  useEffect(() => { load(); }, []);
  async function openPurchase(row: any) {
    setSelected(await api(`/compras/${row.id}`));
  }
  async function annul(row: any) {
    if (!confirmAction(`¿Anular la compra de ${row.proveedorNombre}? Esta acción revierte el stock.`)) return;
    try {
      await api(`/compras/${row.id}/anular`, { method: "POST" });
      setSelected(null);
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo anular la compra");
    }
  }
  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = payload(event.currentTarget);
    const product = products.find((p) => p.id === form.productoId);
    const cantidad = Number(form.cantidad);
    const costoUnitario = Number(form.costoUnitario);
    if (!product || cantidad <= 0 || costoUnitario < 0) return;
    setPurchaseItems((current) => [...current.filter((item) => item.product.id !== product.id), { product, cantidad, costoUnitario, actualizarCosto: form.actualizarCosto === "on" }]);
    event.currentTarget.reset();
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = payload(formEl);
    setError("");
    if (!purchaseItems.length) return setError("Agregá al menos un producto a la compra.");
    try {
      await api("/compras", { method: "POST", body: JSON.stringify({ proveedorId: supplierId || null, proveedorNombre: form.proveedorNombre, fecha: form.fecha, items: purchaseItems.map((item) => ({ productoId: item.product.id, cantidad: item.cantidad, costoUnitario: item.costoUnitario ?? 0, actualizarCosto: item.actualizarCosto ?? true })) }) });
      formEl.reset();
      setSupplierName("");
      setSupplierId("");
      setPurchaseItems([]);
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo registrar la compra");
    }
  }
  const total = purchaseItems.reduce((sum, item) => sum + item.cantidad * (item.costoUnitario ?? 0), 0);
  const rows = items.map(formatPurchaseRow);
  return <div className="purchase-page">
    <section className="panel wide">
      <h2>Compras registradas</h2>
      <FilterPanel filters={filters} setFilters={setFilters} products={products} onSubmit={(e) => { e.preventDefault(); load(filters); }} onClear={() => { const clean = { proveedor: "", productoId: "", fechaDesde: "", fechaHasta: "" }; setFilters(clean); load(clean); }} />
      <Table rows={rows} cols={[["proveedorNombre", "Proveedor"], ["fechaCorta", "Fecha"], ["totalFmt", "Total"], ["itemsCount", "Ítems"], ["estado", "Estado"]]} onRowClick={openPurchase} actions={(row) => isAdmin && row.estado === "ACTIVA" ? <button type="button" className="secondary" onClick={() => annul(row)}>Anular</button> : null} />
    </section>
    <div className="purchase-workspace">
      {canWrite && <section className="panel purchase-builder">
        <h2>Nueva compra</h2>
        <div className="step-block">
          <span className="step-badge">1</span>
          <form id="new-purchase" className="form-grid" onSubmit={create}>
            <SupplierPicker suppliers={suppliers.filter((supplier) => supplier.activo)} value={supplierId} manualName={supplierName} onChange={(supplier) => { setSupplierId(supplier?.id ?? ""); setSupplierName(supplier?.nombre ?? ""); }} onManualNameChange={(value) => { setSupplierName(value); setSupplierId(""); }} />
            <label className="field-label"><span>Fecha de compra</span><input name="fecha" type="date" defaultValue={dateInput()} required /></label>
          </form>
        </div>
        <div className="step-block">
          <span className="step-badge">2</span>
          <div className="purchase-add-line">
            <ProductPicker products={products} name="productoId" form="add-purchase-product" />
            <label className="field-label"><span>Cantidad</span><input name="cantidad" form="add-purchase-product" type="number" min="1" placeholder="Unidades" required /></label>
            <label className="field-label"><span>Costo unitario</span><input name="costoUnitario" form="add-purchase-product" type="number" step="0.01" min="0" placeholder="0,00" required /></label>
            <label className="check purchase-check"><input name="actualizarCosto" form="add-purchase-product" type="checkbox" defaultChecked />Actualizar costo del producto</label>
            <button type="submit" form="add-purchase-product">Agregar</button>
          </div>
        </div>
        <div className="step-block">
          <span className="step-badge">3</span>
          <div className="stack">
            <ItemList items={purchaseItems} mode="compra" onRemove={(id) => setPurchaseItems((current) => current.filter((item) => item.product.id !== id))} />
            <Metric label="Total compra" value={money(total)} />
            {error && <p className="error">{error}</p>}
            <button type="submit" form="new-purchase">Registrar compra</button>
          </div>
        </div>
        <form id="add-purchase-product" onSubmit={addItem} />
      </section>}
      <section className="panel purchase-detail-slot">
        {selected ? <PurchaseDetail purchase={selected} onClose={() => setSelected(null)} /> : <div className="empty-state"><h2>Detalle de compra</h2><p>Seleccioná una compra del historial para ver sus productos, costos y estado.</p></div>}
      </section>
    </div>
  </div>;
}

function PurchaseDetail({ purchase, onClose }: { purchase: any; onClose: () => void }) {
  const rows = (purchase.items ?? []).map((item: any) => ({ ...item, productoNombre: item.producto?.nombre ?? "-", costoFmt: money(item.costoUnitario), subtotalFmt: money(item.subtotal), actualizarFmt: item.actualizarCosto ? "Sí" : "No" }));
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Detalle de compra ${purchase.proveedorNombre}`}><section className="purchase-detail-modal"><div className="detail-head"><div><h2>{purchase.proveedorNombre}</h2><span>{formatDate(purchase.fecha)} · {purchase.estado}</span></div><button type="button" className="icon-button" onClick={onClose} title="Cerrar detalle"><X size={18} /></button></div><Metric label="Total compra" value={money(purchase.total)} /><Table rows={rows} cols={[["productoNombre", "Producto"], ["cantidad", "Cantidad"], ["costoFmt", "Costo"], ["subtotalFmt", "Subtotal"], ["actualizarFmt", "Actualizó costo"]]} /></section></div>;
}

function SupplierPicker({ suppliers, value, manualName, onChange, onManualNameChange }: { suppliers: Supplier[]; value: string; manualName: string; onChange: (supplier: Supplier | null) => void; onManualNameChange: (value: string) => void }) {
  return <div className="supplier-picker">
    <input type="hidden" name="proveedorNombre" value={manualName} required />
    <EntityPicker items={suppliers} value={value} onChange={(id) => onChange(suppliers.find((supplier) => supplier.id === id) ?? null)} title="Elegir proveedor" placeholder="Elegir proveedor cargado" searchPlaceholder="Buscar proveedor, contacto o CUIT" getLabel={(supplier) => supplier.nombre} getMeta={(supplier) => `${supplier.contacto ?? "Sin contacto"} · ${supplier.telefono ?? "sin teléfono"}`} />
    <label className="field-label"><span>Proveedor ocasional</span><input value={manualName} onChange={(event) => onManualNameChange(event.target.value)} placeholder="Escribir nombre si no está cargado" required /></label>
  </div>;
}
