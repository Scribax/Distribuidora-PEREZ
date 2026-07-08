import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";

export function ProductsView({ api, canWrite, isAdmin }: { api: ReturnType<typeof useApi>; canWrite: boolean; isAdmin: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("ACTIVO");
  const [categoriaId, setCategoriaId] = useState("");
  const [error, setError] = useState("");
  const load = (term = q, nextEstado = estado, nextCategoria = categoriaId) => Promise.all([
    api(`/productos?${qs({ q: term.trim(), estado: nextEstado, categoriaId: nextCategoria, pageSize: 1000 })}`),
    api("/categorias")
  ]).then(([p, c]) => { setProducts(p.items); setCategories(c); });
  useEffect(() => { load(q, "ACTIVO", categoriaId); }, []);
  async function refreshSelected(id?: string) {
    if (id) setSelectedProduct(await api(`/productos/${id}`));
  }
  async function openProduct(product: Product) {
    await refreshSelected(product.id);
  }
  function filterProducts(event?: React.FormEvent) {
    event?.preventDefault();
    load(q, estado, categoriaId);
  }
  function clearFilter() {
    setQ("");
    setEstado("ACTIVO");
    setCategoriaId("");
    load("", "ACTIVO", "");
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = payload(formEl);
    setError("");
    try {
      await api("/productos", { method: "POST", body: JSON.stringify(productBody(form)) });
      formEl.reset();
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo crear el producto");
    }
  }
  async function updateProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProduct) return;
    const form = payload(event.currentTarget);
    setError("");
    try {
      await api(`/productos/${selectedProduct.id}`, { method: "PATCH", body: JSON.stringify({ ...productBody(form), activo: form.activo === "true" }) });
      await load();
      await refreshSelected(selectedProduct.id);
    } catch (err: any) {
      setError(err.message ?? "No se pudo actualizar el producto");
    }
  }
  async function deleteProduct(product: Product) {
    if (!confirmAction(`¿Eliminar el producto ${product.nombre}? Si no tiene historial de ventas o compras, se borrará definitivamente del sistema. Si ya tiene historial, quedará inactivo.`)) return;
    setError("");
    try {
      await api(`/productos/${product.id}`, { method: "DELETE" });
      if (selectedProduct?.id === product.id) setSelectedProduct(null);
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo eliminar el producto");
    }
  }
  async function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setError("");
    try {
      await api("/categorias", { method: "POST", body: JSON.stringify(payload(formEl)) });
      formEl.reset();
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo crear la categoría");
    }
  }
  async function updateCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = payload(event.currentTarget);
    if (!form.categoriaId) return;
    try {
      await api(`/categorias/${form.categoriaId}`, { method: "PATCH", body: JSON.stringify({ nombre: form.nombre, activo: form.activo === "true" }) });
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo actualizar la categoría");
    }
  }
  async function increasePrices(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = payload(event.currentTarget);
    if (!confirmAction("¿Aplicar aumento masivo de precios?")) return;
    try {
      const result = await api("/productos/aumentar-precios", {
        method: "POST",
        body: JSON.stringify({
          categoriaId: form.categoriaId || undefined,
          porcentaje: Number(form.porcentaje),
          aplicarMayorista: form.aplicarMayorista === "on",
          aplicarMinorista: form.aplicarMinorista === "on"
        })
      });
      await load();
      alert(`Precios actualizados: ${result.actualizados}`);
    } catch (err: any) {
      setError(err.message ?? "No se pudo aplicar el aumento");
    }
  }
  const activeCount = products.filter((p) => p.activo).length;
  const lowStockCount = products.filter((p) => p.activo && p.stockActual <= p.stockMinimo).length;
  const stockValue = products.reduce((total, product) => total + Number(product.costo) * product.stockActual, 0);
  return <div className="products-page">
    <section className="products-hero">
      <div>
        <h2>Catálogo</h2>
        <span>{products.length} productos encontrados</span>
      </div>
      <div className="products-kpis">
        <Metric label="Activos" value={String(activeCount)} />
        <Metric label="Inactivos" value={String(products.length - activeCount)} />
        <Metric label="Stock bajo" value={String(lowStockCount)} />
        <Metric label="Valor stock" value={money(stockValue)} />
      </div>
    </section>
    <div className="products-layout">
      <section className="panel products-list-panel">
        <form className="products-toolbar" onSubmit={filterProducts}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código, producto o categoría" />
          <select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option></select>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}><option value="">Todas las categorías</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}</select>
          <button>Filtrar</button><button type="button" className="secondary" onClick={clearFilter}>Limpiar</button>
        </form>
        <div className="products-list">
          {products.map((product) => <ProductCard key={product.id} product={product} selected={selectedProduct?.id === product.id} isAdmin={isAdmin} onOpen={openProduct} onDelete={deleteProduct} />)}
          {!products.length && <p className="muted">No hay productos con estos filtros.</p>}
        </div>
      </section>
      <div className="products-management">
        {canWrite && <section className="panel products-create-panel"><h2>Nuevo producto</h2><form className="form product-form" onSubmit={create}><ProductFormFields categories={categories} />{error && <p className="error">{error}</p>}<button>Crear producto</button></form></section>}
        {isAdmin && <section className="panel products-admin-panel"><h2>Categorías</h2><form className="form" onSubmit={createCategory}><input name="nombre" placeholder="Nueva categoría" required /><button>Crear categoría</button></form><form className="form compact-form" onSubmit={updateCategory}><select name="categoriaId" required><option value="">Editar categoría</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}</select><input name="nombre" placeholder="Nuevo nombre" required /><select name="activo"><option value="true">Activa</option><option value="false">Inactiva</option></select><button>Guardar</button></form></section>}
        {isAdmin && <section className="panel products-admin-panel"><h2>Aumento de precios</h2><form className="form" onSubmit={increasePrices}><select name="categoriaId"><option value="">Todos los rubros</option>{categories.filter((c) => c.activo !== false).map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}</select><input name="porcentaje" type="number" step="0.01" placeholder="Porcentaje de aumento" required /><label className="check"><input name="aplicarMayorista" type="checkbox" defaultChecked />Mayorista</label><label className="check"><input name="aplicarMinorista" type="checkbox" defaultChecked />Minorista</label><button>Aplicar aumento</button></form></section>}
      </div>
    </div>
    {selectedProduct && <ProductDetail product={selectedProduct} categories={categories} canWrite={canWrite} isAdmin={isAdmin} onUpdate={updateProduct} onDelete={() => deleteProduct(selectedProduct)} onClose={() => setSelectedProduct(null)} />}
  </div>;
}

function ProductCard({ product, selected, isAdmin, onOpen, onDelete }: { product: Product; selected: boolean; isAdmin: boolean; onOpen: (product: Product) => void; onDelete: (product: Product) => void }) {
  const lowStock = product.activo && product.stockActual <= product.stockMinimo;
  return <article className={`product-card ${selected ? "selected" : ""} ${!product.activo ? "inactive" : ""}`}>
    <button type="button" className="product-card-main" onClick={() => onOpen(product)}>
      <div className="product-card-title">
        <strong>{product.nombre}</strong>
        <span>{product.codigoInterno} · {product.categoria?.nombre ?? "Sin categoría"}</span>
      </div>
      <div className="product-card-values">
        <span><small>Stock</small><strong className={lowStock ? "stock-alert" : undefined}>{product.stockActual}</strong></span>
        <span><small>Mayorista</small><strong>{money(product.precioMayorista)}</strong></span>
        <span><small>Minorista</small><strong>{money(product.precioMinorista)}</strong></span>
        <span><small>Costo</small><strong>{money(product.costo)}</strong></span>
      </div>
      <span className={`status-chip ${product.activo ? "activo" : "cancelado"}`}>{product.activo ? "Activo" : "Inactivo"}</span>
    </button>
    {isAdmin && <button type="button" className="icon-button product-delete" onClick={() => onDelete(product)} title="Eliminar producto"><Trash2 size={16} /></button>}
  </article>;
}

function productBody(form: Record<string, FormDataEntryValue>) {
  return {
    codigoInterno: String(form.codigoInterno ?? "").trim() || undefined,
    nombre: String(form.nombre),
    categoriaId: String(form.categoriaId),
    precioMayorista: Number(form.precioMayorista),
    precioMinorista: Number(form.precioMinorista),
    costo: Number(form.costo),
    stockActual: Number(form.stockActual),
    stockMinimo: Number(form.stockMinimo)
  };
}

function ProductFormFields({ product, categories }: { product?: Product; categories: any[] }) {
  return <>
    <label className="field-label"><span>Código interno</span><input name="codigoInterno" defaultValue={product?.codigoInterno} placeholder="Automático si queda vacío" /></label>
    <label className="field-label"><span>Nombre del producto</span><input name="nombre" defaultValue={product?.nombre} placeholder="Ej. Salsa de tomate 500g" required /></label>
    <label className="field-label"><span>Categoría</span><select name="categoriaId" defaultValue={product?.categoriaId ?? product?.categoria?.id ?? ""} required><option value="">Seleccionar categoría</option>{categories.filter((c) => c.activo !== false || c.id === (product?.categoriaId ?? product?.categoria?.id)).map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}</select></label>
    <label className="field-label"><span>Precio mayorista</span><input name="precioMayorista" type="number" step="0.01" min="0" defaultValue={product ? Number(product.precioMayorista) : undefined} placeholder="0,00" required /></label>
    <label className="field-label"><span>Precio minorista</span><input name="precioMinorista" type="number" step="0.01" min="0" defaultValue={product ? Number(product.precioMinorista) : undefined} placeholder="0,00" required /></label>
    <label className="field-label"><span>Costo unitario</span><input name="costo" type="number" step="0.01" min="0" defaultValue={product ? Number(product.costo) : undefined} placeholder="0,00" required /></label>
    <label className="field-label"><span>Stock actual</span><input name="stockActual" type="number" min="0" defaultValue={product?.stockActual} placeholder="Cantidad disponible" required /></label>
    <label className="field-label"><span>Stock mínimo</span><input name="stockMinimo" type="number" min="0" defaultValue={product?.stockMinimo} placeholder="Alerta desde esta cantidad" required /></label>
  </>;
}

function ProductDetail({ product, categories, canWrite, isAdmin, onUpdate, onDelete, onClose }: { product: Product; categories: any[]; canWrite: boolean; isAdmin: boolean; onUpdate: (event: React.FormEvent<HTMLFormElement>) => void; onDelete: () => void; onClose: () => void }) {
  const stockValue = Number(product.costo) * product.stockActual;
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Detalle de ${product.nombre}`}>
  <section className="product-detail-modal">
    <div className="detail-head"><div><h2>{product.nombre}</h2><span>{product.codigoInterno} · {product.categoria?.nombre ?? "Sin categoría"} · {product.activo ? "Activo" : "Inactivo"}</span></div><div className="table-actions">{isAdmin && <button type="button" className="danger" onClick={onDelete}>Eliminar</button>}<button type="button" className="icon-button" onClick={onClose} title="Cerrar detalle"><X size={18} /></button></div></div>
    <div className="detail-grid">
      <Metric label="Stock actual" value={String(product.stockActual)} /><Metric label="Stock mínimo" value={String(product.stockMinimo)} /><Metric label="Costo" value={money(product.costo)} /><Metric label="Valor stock" value={money(stockValue)} /><Metric label="Mayorista" value={money(product.precioMayorista)} /><Metric label="Minorista" value={money(product.precioMinorista)} />
    </div>
    {canWrite && <form className="form product-form" onSubmit={onUpdate}><h3>Editar producto</h3><ProductFormFields product={product} categories={categories} /><select name="activo" defaultValue={String(product.activo)}><option value="true">Activo</option><option value="false">Inactivo</option></select><button>Guardar producto</button></form>}
    <h3>Movimientos recientes</h3>
    <Table rows={(product.movimientos ?? []).map(formatMovementRow)} cols={[["createdFmt", "Fecha"], ["tipoFmt", "Tipo"], ["cantidad", "Cantidad"], ["stockResultante", "Stock"], ["motivo", "Motivo"]]} />
  </section>
  </div>;
}
