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
  const [estado, setEstado] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [error, setError] = useState("");
  const load = (term = q, nextEstado = estado, nextCategoria = categoriaId) => Promise.all([
    api(`/productos?${qs({ q: term.trim(), estado: nextEstado, categoriaId: nextCategoria, pageSize: 100 })}`),
    api("/categorias")
  ]).then(([p, c]) => { setProducts(p.items); setCategories(c); });
  useEffect(() => { load(); }, []);
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
    setEstado("");
    setCategoriaId("");
    load("", "", "");
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
  const productRows = products.map((p) => ({ ...p, activoFmt: p.activo ? "Activo" : "Inactivo", costoFmt: money(p.costo), mayoristaFmt: money(p.precioMayorista), minoristaFmt: money(p.precioMinorista) }));
  return <div className="grid two">
    <section className="panel wide">
      <form className="filters filters-wide" onSubmit={filterProducts}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código, producto o categoría" />
        <select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option></select>
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}><option value="">Todas las categorías</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}</select>
        <button>Filtrar</button><button type="button" className="secondary" onClick={clearFilter}>Limpiar</button>
      </form>
      <Table rows={productRows} cols={[["codigoInterno", "Código"], ["nombre", "Producto"], ["categoria.nombre", "Categoría"], ["stockActual", "Stock"], ["mayoristaFmt", "Mayorista"], ["minoristaFmt", "Minorista"], ["costoFmt", "Costo"], ["activoFmt", "Estado"]]} onRowClick={openProduct} />
    </section>
    <div className="stack">
      {selectedProduct && <ProductDetail product={selectedProduct} categories={categories} canWrite={canWrite} onUpdate={updateProduct} onClose={() => setSelectedProduct(null)} />}
      {isAdmin && <section className="panel"><h2>Categorías</h2><form className="form" onSubmit={createCategory}><input name="nombre" placeholder="Nueva categoría" required /><button>Crear categoría</button></form><form className="form compact-form" onSubmit={updateCategory}><select name="categoriaId" required><option value="">Editar categoría</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}</select><input name="nombre" placeholder="Nuevo nombre" required /><select name="activo"><option value="true">Activa</option><option value="false">Inactiva</option></select><button>Guardar</button></form></section>}
      {isAdmin && <section className="panel"><h2>Aumento de precios</h2><form className="form" onSubmit={increasePrices}><select name="categoriaId"><option value="">Todos los rubros</option>{categories.filter((c) => c.activo !== false).map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}</select><input name="porcentaje" type="number" step="0.01" placeholder="Porcentaje de aumento" required /><label className="check"><input name="aplicarMayorista" type="checkbox" defaultChecked />Mayorista</label><label className="check"><input name="aplicarMinorista" type="checkbox" defaultChecked />Minorista</label><button>Aplicar aumento</button></form></section>}
      {canWrite && <section className="panel"><h2>Nuevo producto</h2><form className="form" onSubmit={create}><ProductFormFields categories={categories} />{error && <p className="error">{error}</p>}<button>Crear producto</button></form></section>}
    </div>
  </div>;
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
    <input name="codigoInterno" defaultValue={product?.codigoInterno} placeholder="Código automático" />
    <input name="nombre" defaultValue={product?.nombre} placeholder="Nombre" required />
    <select name="categoriaId" defaultValue={product?.categoriaId ?? product?.categoria?.id ?? ""} required><option value="">Categoría</option>{categories.filter((c) => c.activo !== false || c.id === (product?.categoriaId ?? product?.categoria?.id)).map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}</select>
    <input name="precioMayorista" type="number" step="0.01" min="0" defaultValue={product ? Number(product.precioMayorista) : undefined} placeholder="Mayorista" required />
    <input name="precioMinorista" type="number" step="0.01" min="0" defaultValue={product ? Number(product.precioMinorista) : undefined} placeholder="Minorista" required />
    <input name="costo" type="number" step="0.01" min="0" defaultValue={product ? Number(product.costo) : undefined} placeholder="Costo" required />
    <input name="stockActual" type="number" min="0" defaultValue={product?.stockActual} placeholder="Stock" required />
    <input name="stockMinimo" type="number" min="0" defaultValue={product?.stockMinimo} placeholder="Stock mínimo" required />
  </>;
}

function ProductDetail({ product, categories, canWrite, onUpdate, onClose }: { product: Product; categories: any[]; canWrite: boolean; onUpdate: (event: React.FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  const stockValue = Number(product.costo) * product.stockActual;
  return <section className="panel detail-panel">
    <div className="detail-head"><div><h2>{product.nombre}</h2><span>{product.codigoInterno} · {product.categoria?.nombre ?? "Sin categoría"} · {product.activo ? "Activo" : "Inactivo"}</span></div><button type="button" className="icon-button" onClick={onClose} title="Cerrar detalle"><X size={18} /></button></div>
    <div className="detail-grid">
      <Metric label="Stock actual" value={String(product.stockActual)} /><Metric label="Stock mínimo" value={String(product.stockMinimo)} /><Metric label="Costo" value={money(product.costo)} /><Metric label="Valor stock" value={money(stockValue)} /><Metric label="Mayorista" value={money(product.precioMayorista)} /><Metric label="Minorista" value={money(product.precioMinorista)} />
    </div>
    {canWrite && <form className="form" onSubmit={onUpdate}><h3>Editar producto</h3><ProductFormFields product={product} categories={categories} /><select name="activo" defaultValue={String(product.activo)}><option value="true">Activo</option><option value="false">Inactivo</option></select><button>Guardar producto</button></form>}
    <h3>Movimientos recientes</h3>
    <Table rows={(product.movimientos ?? []).map(formatMovementRow)} cols={[["createdFmt", "Fecha"], ["tipoFmt", "Tipo"], ["cantidad", "Cantidad"], ["stockResultante", "Stock"], ["motivo", "Motivo"]]} />
  </section>;
}

