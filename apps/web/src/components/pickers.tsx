import { useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { LineItem, Product } from "../types";
import { itemPrice, money } from "../utils";

export function EntityPicker<T extends { id: string }>({ items, value, onChange, name, form, title, placeholder, searchPlaceholder, getLabel, getMeta, required = false }: { items: T[]; value: string; onChange: (value: string) => void; name?: string; form?: string; title: string; placeholder: string; searchPlaceholder: string; getLabel: (item: T) => string; getMeta?: (item: T) => string; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [letter, setLetter] = useState("");
  const selected = items.find((item) => item.id === value);
  const normalizedTerm = term.toLowerCase().trim();
  const sortedItems = [...items].sort((a, b) => getLabel(a).localeCompare(getLabel(b), "es"));
  const letters = Array.from(new Set(sortedItems.map((item) => getLabel(item).trim().charAt(0).toUpperCase()).filter(Boolean)));
  const visibleItems = sortedItems.filter((item) => {
    const haystack = `${getLabel(item)} ${getMeta?.(item) ?? ""}`.toLowerCase();
    const matchesTerm = !normalizedTerm || haystack.includes(normalizedTerm);
    const matchesLetter = !letter || getLabel(item).trim().toUpperCase().startsWith(letter);
    return matchesTerm && matchesLetter;
  });
  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setTerm("");
    setLetter("");
  }
  return <div className="entity-picker">
    {name && <select className="sr-select" name={name} form={form} value={value} required={required} onChange={(event) => onChange(event.target.value)} aria-hidden="true" tabIndex={-1}><option value=""></option>{items.map((item) => <option value={item.id} key={item.id}>{getLabel(item)}</option>)}</select>}
    <button type="button" className={`picker-trigger${selected ? " has-value" : ""}`} onClick={() => setOpen(true)}>
      <span>{selected ? getLabel(selected) : placeholder}</span>
      {selected && getMeta && <small>{getMeta(selected)}</small>}
    </button>
    {open && <div className="modal-backdrop selector-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={() => setOpen(false)}>
      <div className="selector-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="selector-head">
          <div><h3>{title}</h3><span>{visibleItems.length} resultado{visibleItems.length === 1 ? "" : "s"}</span></div>
          <button type="button" className="icon-button" onClick={() => setOpen(false)} title="Cerrar"><X size={18} /></button>
        </div>
        <div className="selector-search"><Search size={18} /><input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder={searchPlaceholder} /></div>
        <div className="letter-strip">
          <button type="button" className={!letter ? "active" : undefined} onClick={() => setLetter("")}>Todos</button>
          {letters.map((itemLetter) => <button type="button" className={letter === itemLetter ? "active" : undefined} key={itemLetter} onClick={() => setLetter(itemLetter)}>{itemLetter}</button>)}
        </div>
        <div className="selector-list">
          {!required && <button type="button" className="selector-row muted-choice" onClick={() => choose("")}><strong>{placeholder}</strong><span>Dejar sin seleccionar</span></button>}
          {visibleItems.map((item) => <button type="button" className={`selector-row${value === item.id ? " selected" : ""}`} key={item.id} onClick={() => choose(item.id)}><strong>{getLabel(item)}</strong>{getMeta && <span>{getMeta(item)}</span>}</button>)}
          {!visibleItems.length && <p className="muted empty-selector">No hay resultados.</p>}
        </div>
      </div>
    </div>}
  </div>;
}

export function ProductPicker({ products, name, form, value, onChange }: { products: Product[]; name: string; form?: string; value?: string; onChange?: (value: string) => void }) {
  const [internalValue, setInternalValue] = useState("");
  return <EntityPicker items={products} value={value ?? internalValue} onChange={onChange ?? setInternalValue} name={name} form={form} title="Elegir producto" placeholder="Elegir producto" searchPlaceholder="Buscar por código, nombre o rubro" getLabel={(product) => product.nombre} getMeta={(product) => `${product.codigoInterno} · stock ${product.stockActual} · ${product.categoria?.nombre ?? "Sin rubro"}`} required />;
}

export function ItemList({ items, mode, onRemove, priceList }: { items: LineItem[]; mode: "compra" | "remito"; onRemove: (productId: string) => void; priceList?: "MAYORISTA" | "MINORISTA" }) {
  if (!items.length) return <p className="muted">Todavía no agregaste productos.</p>;
  return <div className="line-items">{items.map((item) => { const unit = mode === "compra" ? item.costoUnitario ?? 0 : itemPrice(item.product, priceList ?? "MAYORISTA"); return <div className="line-item" key={item.product.id}><div><strong>{item.product.nombre}</strong><span>{item.product.codigoInterno} · cant. {item.cantidad} · unit. {money(unit)}{mode === "compra" ? ` · actualiza costo ${item.actualizarCosto === false ? "no" : "sí"}` : ""}</span></div><strong>{money(item.cantidad * unit)}</strong><button type="button" className="icon-button" onClick={() => onRemove(item.product.id)} title="Quitar producto"><Trash2 size={17} /></button></div>; })}</div>;
}

export function FilterPanel({ filters, setFilters, products, onSubmit, onClear }: { filters: { proveedor: string; productoId: string; fechaDesde: string; fechaHasta: string }; setFilters: (v: any) => void; products: Product[]; onSubmit: (e: React.FormEvent) => void; onClear: () => void }) {
  return <form className="filters filters-wide" onSubmit={onSubmit}><input value={filters.proveedor} onChange={(e) => setFilters({ ...filters, proveedor: e.target.value })} placeholder="Proveedor" /><select value={filters.productoId} onChange={(e) => setFilters({ ...filters, productoId: e.target.value })}><option value="">Todos los productos</option>{products.map((p) => <option value={p.id} key={p.id}>{p.nombre}</option>)}</select><input type="date" value={filters.fechaDesde} onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })} /><input type="date" value={filters.fechaHasta} onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })} /><button>Filtrar</button><button type="button" className="secondary" onClick={onClear}>Limpiar</button></form>;
}
