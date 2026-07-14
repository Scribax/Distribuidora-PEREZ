import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";

export function StockView({ api, isAdmin }: { api: ReturnType<typeof useApi>; isAdmin: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filters, setFilters] = useState({ productoId: "", tipo: "", fechaDesde: "", fechaHasta: "" });
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ totalProducts: 0, lowStockCount: 0, stockValue: 0 });
  const [adjustProductId, setAdjustProductId] = useState("");

  const load = (next = filters) => Promise.all([
    api(`/stock/movimientos?${qs({ ...next, pageSize: 100 })}`),
    api("/productos?pageSize=1000&estado=ACTIVO"),
    api("/stock/stats")
  ]).then(([movs, prods, st]) => {
    setRows(movs.items);
    setProducts(prods.items);
    setStats(st);
  });
  useEffect(() => { load(); }, []);
  async function adjust(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = payload(event.currentTarget);
    if (!adjustProductId) return setError("Elegí un producto para ajustar.");
    if (!confirmAction("¿Confirmar ajuste manual de stock?")) return;
    try {
      await api("/stock/ajustes", { method: "POST", body: JSON.stringify({ productoId: adjustProductId, cantidadNueva: Number(form.cantidadNueva), motivo: form.motivo }) });
      event.currentTarget.reset();
      setAdjustProductId("");
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo ajustar el stock");
    }
  }
  const movementsByProduct = useMemo(() => {
    const map = new Map<string, any[]>();
    rows.forEach((row) => {
      const current = map.get(row.productoId) ?? [];
      current.push(row);
      map.set(row.productoId, current);
    });
    return map;
  }, [rows]);
  const hasMovementFilters = Boolean(filters.tipo || filters.fechaDesde || filters.fechaHasta);
  const searchTerm = q.trim().toLowerCase();
  const visibleProducts = products
    .filter((product) => !filters.productoId || product.id === filters.productoId)
    .filter((product) => {
      if (!searchTerm) return true;
      return [product.nombre, product.codigoInterno, product.categoria?.nombre].filter(Boolean).join(" ").toLowerCase().includes(searchTerm);
    })
    .filter((product) => !hasMovementFilters || filters.productoId || movementsByProduct.has(product.id));

  const [productPage, setProductPage] = useState(1);
  const productPageSize = 10;

  useEffect(() => {
    setProductPage(1);
  }, [q, filters]);

  const totalProductPages = Math.max(1, Math.ceil(visibleProducts.length / productPageSize));
  const paginatedProducts = visibleProducts.slice((productPage - 1) * productPageSize, productPage * productPageSize);

  return <div className="stock-page">
    <section className="stock-hero">
      <div><h2>Stock</h2><span>Control de existencias por producto, movimientos y ajustes.</span></div>
      <div className="stock-kpis">
        <Metric label="Productos" value={String(stats.totalProducts)} />
        <Metric label="Stock bajo" value={String(stats.lowStockCount)} />
        <Metric label="Movimientos" value={String(rows.length)} />
        <Metric label="Valor stock" value={money(stats.stockValue)} />
      </div>
    </section>
    <div className="stock-layout">
      <section className="panel wide stock-main-panel">
        <div className="stock-toolbar">
          <label className="search-field stock-search">
            <Search size={16} />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar producto, código o rubro" />
          </label>
          <form className="stock-filter-bar" onSubmit={(e) => { e.preventDefault(); load(filters); }}>
            <EntityPicker items={products} value={filters.productoId} onChange={(value) => setFilters({ ...filters, productoId: value })} title="Filtrar por producto" placeholder="Todos los productos" searchPlaceholder="Buscar por nombre, código o rubro" getLabel={(product) => product.nombre} getMeta={(product) => `${product.codigoInterno} · stock ${product.stockActual} · ${product.categoria?.nombre ?? "Sin rubro"}`} />
            <select value={filters.tipo} onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}><option value="">Todos los movimientos</option><option value="COMPRA">Entradas por compra</option><option value="REMITO">Salidas por remito</option><option value="ALTA_PRODUCTO">Stock inicial</option><option value="CANCELACION_REMITO">Cancelaciones</option><option value="ANULACION_COMPRA">Anulación compra</option><option value="AJUSTE_MANUAL">Ajuste manual</option></select>
            <input type="date" value={filters.fechaDesde} onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })} />
            <input type="date" value={filters.fechaHasta} onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })} />
            <button>Filtrar</button><button type="button" className="secondary" onClick={() => { const clean = { productoId: "", tipo: "", fechaDesde: "", fechaHasta: "" }; setFilters(clean); setQ(""); load(clean); }}>Limpiar</button>
          </form>
        </div>
        <div className="section-title stock-results-title">
          <h3>Productos</h3>
          <span>
            {visibleProducts.length > 0 ? (
              `${(productPage - 1) * productPageSize + 1}-${Math.min(productPage * productPageSize, visibleProducts.length)} de ${visibleProducts.length} visibles`
            ) : (
              "0 visibles"
            )}
          </span>
        </div>
        <div className="stock-product-list">
          {paginatedProducts.map((product) => <StockProductCard key={product.id} product={product} movements={movementsByProduct.get(product.id) ?? []} defaultOpen={filters.productoId === product.id} />)}
          {!visibleProducts.length && <p>No hay productos con movimientos para estos filtros.</p>}
        </div>
        {visibleProducts.length > productPageSize && <div className="pager stock-pager" style={{ marginTop: "1rem" }}>
          <button type="button" className="secondary" onClick={() => setProductPage((p) => Math.max(1, p - 1))} disabled={productPage === 1}>Anterior</button>
          <span>Página {productPage} de {totalProductPages}</span>
          <button type="button" className="secondary" onClick={() => setProductPage((p) => Math.min(totalProductPages, p + 1))} disabled={productPage === totalProductPages}>Siguiente</button>
        </div>}
      </section>
      {isAdmin && <section className="panel stock-adjust-panel"><div><h2>Ajuste manual</h2><span>Usalo solo para corregir diferencias físicas de stock.</span></div><form className="form" onSubmit={adjust}><EntityPicker items={products} value={adjustProductId} onChange={setAdjustProductId} name="productoId" title="Elegir producto" placeholder="Elegir producto" searchPlaceholder="Buscar por nombre, código o rubro" getLabel={(product) => product.nombre} getMeta={(product) => `${product.codigoInterno} · actual ${product.stockActual}`} required /><input name="cantidadNueva" type="number" min="0" placeholder="Nueva cantidad" required /><input name="motivo" placeholder="Motivo del ajuste" required minLength={10} />{error && <p className="error">{error}</p>}<button>Registrar ajuste</button></form></section>}
    </div>
  </div>;
}

function StockProductCard({ product, movements, defaultOpen }: { product: Product; movements: any[]; defaultOpen: boolean }) {
  const stockValue = Number(product.costo) * product.stockActual;
  const latest = movements[0];
  const isLow = product.stockMinimo > 0 && product.stockActual <= product.stockMinimo;
  const [movementPage, setMovementPage] = useState(1);
  const movementPageSize = 5;
  const totalMovementPages = Math.max(1, Math.ceil(movements.length / movementPageSize));
  const visibleMovements = movements.slice((movementPage - 1) * movementPageSize, movementPage * movementPageSize);
  const movementRows = visibleMovements.map(formatMovementRow);
  const movementStart = movements.length ? (movementPage - 1) * movementPageSize + 1 : 0;
  const movementEnd = Math.min(movementPage * movementPageSize, movements.length);
  useEffect(() => {
    setMovementPage(1);
  }, [product.id, movements.length]);

  return <details className="stock-product-card" open={defaultOpen}>
    <summary>
      <div className="stock-product-main">
        <strong>{product.nombre}</strong>
        <span>{product.codigoInterno} · {product.categoria?.nombre ?? "Sin rubro"}</span>
      </div>
      <div className="stock-product-metrics">
        <span className={isLow ? "stock-alert" : ""}>Stock {product.stockActual}</span>
        <span>Mínimo {product.stockMinimo}</span>
        <span>{money(stockValue)}</span>
      </div>
    </summary>
    <div className="stock-product-body">
      <div className="stock-movement-head">
        {latest && <p className="muted">Último movimiento: {formatDate(latest.createdAt)} · {movementLabel(latest.tipo)}</p>}
        {!!movements.length && <span>{movementStart}-{movementEnd} de {movements.length}</span>}
      </div>
      {movementRows.length ? <div className="stock-movement-table"><Table rows={movementRows} cols={[["createdFmt", "Fecha"], ["tipoFmt", "Tipo"], ["cantidad", "Cantidad"], ["stockResultante", "Stock"], ["motivo", "Motivo"]]} /></div> : <p className="muted">Sin movimientos para los filtros elegidos.</p>}
      {movements.length > movementPageSize && <div className="pager stock-pager">
        <button type="button" className="secondary" onClick={() => setMovementPage((page) => Math.max(1, page - 1))} disabled={movementPage === 1}>Anterior</button>
        <span>Página {movementPage} de {totalMovementPages}</span>
        <button type="button" className="secondary" onClick={() => setMovementPage((page) => Math.min(totalMovementPages, page + 1))} disabled={movementPage === totalMovementPages}>Siguiente</button>
      </div>}
    </div>
  </details>;
}

function StockMovement({ row }: { row: any }) {
  const entrada = row.cantidad > 0;
  const label = movementLabel(row.tipo);
  const date = new Date(row.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  return <div className={`movement ${entrada ? "in" : "out"}`}><div><strong>{row.producto?.nombre ?? "Producto"}</strong><span>{date} · {label}</span></div><div className="movement-numbers"><strong>{entrada ? "Entró" : "Salió"} {Math.abs(row.cantidad)}</strong><span>Quedaron {row.stockResultante}</span></div><small>{row.motivo || referenceLabel(row.referenciaTipo)}</small></div>;
}
