import React, { useEffect, useState } from "react";
import type { useApi } from "../api";
import type { Client, LineItem, Product } from "../types";
import { itemPrice, money, openPdfViewer, payload } from "../utils";
import { Metric } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";

// Cotización: arma un presupuesto y genera el PDF sin tocar stock, saldo ni crear
// registros. Pensado para mandar precios sin el problema de descontar stock cuando
// varias personas trabajan en paralelo.
export function QuotesView({ api, canWrite }: { api: ReturnType<typeof useApi>; canWrite: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [quoteItems, setQuoteItems] = useState<LineItem[]>([]);
  const [priceList, setPriceList] = useState<"MAYORISTA" | "MINORISTA">("MAYORISTA");
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [builderProductId, setBuilderProductId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = () => Promise.all([
    api("/productos?estado=ACTIVO&pageSize=1000"),
    api("/clientes?pageSize=1000")
  ]).then(([p, c]) => { setProducts(p.items); setClients(c.items); });
  useEffect(() => { load(); }, []);

  const activeClients = clients.filter((x) => x.activo);
  const subtotal = quoteItems.reduce((sum, item) => sum + item.cantidad * itemPrice(item.product, priceList), 0);
  const total = subtotal * (1 - Math.min(Math.max(descuentoPorcentaje, 0), 100) / 100);

  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = payload(event.currentTarget);
    const product = products.find((p) => p.id === form.productoId);
    const cantidad = Number(form.cantidad);
    if (!product || cantidad <= 0) return;
    setQuoteItems((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) return current.map((item) => item.product.id === product.id ? { ...item, cantidad: item.cantidad + cantidad } : item);
      return [...current, { product, cantidad }];
    });
    setBuilderProductId("");
    event.currentTarget.reset();
  }

  async function generate() {
    setError("");
    if (!quoteItems.length) return setError("Agregá al menos un producto a la cotización.");
    const nombre = selectedClientId ? (clients.find((c) => c.id === selectedClientId)?.nombre ?? clienteNombre) : clienteNombre;
    if (!nombre.trim()) return setError("Elegí un cliente o escribí un nombre para la cotización.");
    setGenerating(true);
    try {
      const blob = await api("/cotizaciones/pdf", {
        method: "POST",
        headers: { Accept: "application/pdf" },
        body: JSON.stringify({
          clienteId: selectedClientId || null,
          clienteNombre: nombre,
          listaPrecios: priceList,
          descuentoPorcentaje,
          observaciones: observaciones || null,
          items: quoteItems.map((item) => ({ productoId: item.product.id, cantidad: item.cantidad }))
        })
      });
      openPdfViewer(blob, `Cotización · ${nombre}`);
    } catch (err: any) {
      setError(err.message ?? "No se pudo generar la cotización");
    } finally {
      setGenerating(false);
    }
  }

  return <div className="remitos-layout">
    <section className="panel remito-builder">
      <div className="detail-head"><div><h2>Nueva cotización</h2><span>Armá un presupuesto y descargá el PDF. No descuenta stock ni modifica saldos.</span></div></div>
      {!canWrite ? <p className="muted">No tenés permisos para generar cotizaciones.</p> : <>
        <div className="form">
          <div className="step-block"><span className="step-badge">1</span><div className="step-content"><div className="step-title"><strong>Cliente y lista</strong><span>Elegí un cliente cargado o escribí un nombre libre.</span></div><div className="form-grid">
            <EntityPicker items={activeClients} value={selectedClientId} onChange={(id) => { setSelectedClientId(id); const c = clients.find((x) => x.id === id); if (c) setClienteNombre(c.nombre); }} title="Elegir cliente" placeholder="Elegir cliente cargado" searchPlaceholder="Buscar por nombre, dirección o saldo" getLabel={(client) => client.nombre} getMeta={(client) => `${client.direccion ?? "Sin dirección"} · saldo ${money(client.saldoPendiente)}`} />
            <label className="field-label"><span>Cliente ocasional</span><input value={clienteNombre} onChange={(e) => { setClienteNombre(e.target.value); setSelectedClientId(""); }} placeholder="Escribir nombre si no está cargado" /></label>
            <select value={priceList} onChange={(e) => setPriceList(e.target.value as "MAYORISTA" | "MINORISTA")}><option value="MAYORISTA">Lista mayorista</option><option value="MINORISTA">Lista minorista</option></select>
          </div></div></div>
          <div className="step-block"><span className="step-badge">2</span><div className="step-content"><div className="step-title"><strong>Productos</strong><span>Buscá por código, nombre o rubro.</span></div><div className="add-line"><ProductPicker products={products} name="productoId" form="add-quote-product" value={builderProductId} onChange={setBuilderProductId} /><input name="cantidad" form="add-quote-product" type="number" min="1" placeholder="Cantidad" required /><button type="submit" form="add-quote-product">Agregar</button></div></div></div>
          <div className="step-block"><span className="step-badge">3</span><div className="step-content"><div className="step-title"><strong>Descuento y notas</strong><span>Opcional.</span></div><div className="payment-grid">
            <label className="field-card"><span>Descuento</span><input type="number" step="0.01" min="0" max="100" value={descuentoPorcentaje} onChange={(e) => setDescuentoPorcentaje(Number(e.target.value || 0))} placeholder="Ej: 10" /><small>Porcentaje sobre el subtotal.</small></label>
            <label className="field-card"><span>Observaciones</span><input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Ej: validez 7 días" /><small>Aparece en el PDF.</small></label>
          </div></div></div>
          <div className="step-block"><span className="step-badge">4</span><div className="step-content"><div className="step-title"><strong>Resumen</strong><span>Revisá antes de generar el PDF.</span></div><div className="stack">
            <ItemList items={quoteItems} mode="remito" priceList={priceList} onRemove={(id) => setQuoteItems((current) => current.filter((item) => item.product.id !== id))} />
            <Metric label="Subtotal" value={money(subtotal)} />
            {descuentoPorcentaje > 0 && <Metric label={`Descuento ${descuentoPorcentaje}%`} value={`-${money(subtotal - total)}`} />}
            <Metric label="Total cotización" value={money(total)} />
            {error && <p className="error">{error}</p>}
            <button type="button" onClick={generate} disabled={generating}>{generating ? "Generando PDF..." : "Generar cotización PDF"}</button>
          </div></div></div>
        </div>
        <form id="add-quote-product" onSubmit={addItem} />
      </>}
    </section>
  </div>;
}
