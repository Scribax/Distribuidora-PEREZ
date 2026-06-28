import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BarChart3, Boxes, Calculator, LogOut, PackagePlus, ReceiptText, Search, ShoppingCart, Trash2, UserCog, Users, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./styles.css";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

type Role = "ADMINISTRADOR" | "EMPLEADO" | "CONSULTA";
type User = { id: string; nombre: string; email: string; rol: Role; activo?: boolean };
type Session = { accessToken: string; refreshToken: string; user: User };
type Product = { id: string; codigoInterno: string; nombre: string; stockActual: number; stockMinimo: number; precioMayorista: string; precioMinorista: string; costo: string; activo: boolean; categoriaId?: string; categoria?: { id?: string; nombre: string }; movimientos?: any[] };
type Client = { id: string; nombre: string; empresa?: string; direccion?: string; telefono?: string; email?: string; observaciones?: string; saldoPendiente: string; activo: boolean; remitos?: any[] };
type Vendor = { id: string; nombre: string; porcentajeComision: string; activo: boolean };
type Dashboard = { ventasMes: number; comprasMes: number; balanceMes: number; valorStock: number; stockBajo: Product[]; ultimosRemitos: any[]; chart: { mes: string; ventas: number; compras: number }[] };
type LineItem = { product: Product; cantidad: number; costoUnitario?: number; actualizarCosto?: boolean };

function money(value: number | string) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(value));
}

function dateInput(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function qs(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query.toString();
}

function confirmAction(message: string) {
  return window.confirm(message);
}

function payload(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form));
}

function useApi(session: Session | null, setSession: (s: Session | null) => void) {
  return useMemo(() => async (path: string, init: RequestInit = {}) => {
    const run = async (token?: string) => fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers
      }
    });
    let res = await run(session?.accessToken);
    if (res.status === 401 && session?.refreshToken) {
      const refreshed = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken })
      });
      if (refreshed.ok) {
        const next = await refreshed.json();
        setSession(next);
        localStorage.setItem("perez_session", JSON.stringify(next));
        res = await run(next.accessToken);
      } else {
        setSession(null);
        localStorage.removeItem("perez_session");
      }
    }
    if (!res.ok) throw await res.json();
    if (res.status === 204) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/pdf") || contentType.includes("spreadsheet")) return res.blob();
    return res.json();
  }, [session, setSession]);
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!res.ok) throw await res.json();
      const session = await res.json();
      localStorage.setItem("perez_session", JSON.stringify(session));
      onLogin(session);
    } catch (err: any) {
      setError(err.message ?? "No se pudo iniciar sesión");
    }
  }
  return <main className="login-shell">
    <form className="login-panel" onSubmit={submit}>
      <strong>PEREZ MARTIN</strong>
      <h1>Gestión operativa</h1>
      <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <p className="error">{error}</p>}
      <button>Ingresar</button>
    </form>
  </main>;
}

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem("perez_session");
    return raw ? JSON.parse(raw) : null;
  });
  const [view, setView] = useState("dashboard");
  const api = useApi(session, setSession);
  if (!session) return <Login onLogin={setSession} />;
  const nav = [
    ["dashboard", BarChart3, "Dashboard"],
    ["productos", Boxes, "Productos"],
    ["clientes", Users, "Clientes"],
    ["compras", ShoppingCart, "Compras"],
    ["remitos", ReceiptText, "Ventas"],
    ...(session.user.rol === "CONSULTA" ? [] : [["balance", Calculator, "Balance"] as const]),
    ...(session.user.rol === "CONSULTA" ? [] : [["informes", BarChart3, "Informes"] as const]),
    ...(session.user.rol === "CONSULTA" ? [] : [["vendedores", UserCog, "Vendedores"] as const]),
    ["stock", PackagePlus, "Stock"],
    ...(session.user.rol === "ADMINISTRADOR" ? [["usuarios", UserCog, "Usuarios"] as const] : [])
  ] as const;
  return <div className="app">
    <aside>
      <div className="brand"><img src="/brand-logo.png" alt="Perez Martin Distribuidora" /></div>
      {nav.map(([id, Icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)} title={label}><Icon size={18} />{label}</button>)}
      <button className="logout" onClick={() => { localStorage.removeItem("perez_session"); setSession(null); }}><LogOut size={18} />Salir</button>
    </aside>
    <section className="workspace">
      <header><h1>{nav.find(([id]) => id === view)?.[2]}</h1><span>{session.user.nombre} · {session.user.rol}</span></header>
      {view === "dashboard" && <DashboardView api={api} />}
      {view === "productos" && <ProductsView api={api} canWrite={session.user.rol !== "CONSULTA"} isAdmin={session.user.rol === "ADMINISTRADOR"} />}
      {view === "clientes" && <ClientsView api={api} canWrite={session.user.rol !== "CONSULTA"} canEditBalance={session.user.rol === "ADMINISTRADOR"} />}
      {view === "compras" && <PurchasesView api={api} canWrite={session.user.rol !== "CONSULTA"} isAdmin={session.user.rol === "ADMINISTRADOR"} />}
      {view === "remitos" && <RemittancesView api={api} canWrite={session.user.rol !== "CONSULTA"} />}
      {view === "balance" && <BalanceView api={api} />}
      {view === "informes" && <ReportsView api={api} />}
      {view === "vendedores" && <VendorsView api={api} />}
      {view === "stock" && <StockView api={api} isAdmin={session.user.rol === "ADMINISTRADOR"} />}
      {view === "usuarios" && <UsersView api={api} />}
    </section>
  </div>;
}

function DashboardView({ api }: { api: ReturnType<typeof useApi> }) {
  const [data, setData] = useState<Dashboard | null>(null);
  useEffect(() => { api("/dashboard").then(setData); }, [api]);
  if (!data) return <p>Cargando...</p>;
  return <>
    <div className="metrics">
      <Metric label="Ventas del mes" value={money(data.ventasMes)} />
      <Metric label="Compras del mes" value={money(data.comprasMes)} />
      <Metric label="Balance" value={money(data.balanceMes)} />
      <Metric label="Valor stock" value={money(data.valorStock)} />
    </div>
    <div className="grid two">
      <section className="panel"><h2>Ventas vs compras</h2><ResponsiveContainer width="100%" height={260}><BarChart data={data.chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis /><Tooltip /><Legend /><Bar dataKey="ventas" fill="#d71920" /><Bar dataKey="compras" fill="#2563eb" /></BarChart></ResponsiveContainer></section>
      <section className="panel"><h2>Stock bajo</h2>{data.stockBajo.length ? data.stockBajo.map((p) => <Row key={p.id} title={p.nombre} meta={`${p.stockActual} / mínimo ${p.stockMinimo}`} />) : <p>Sin alertas.</p>}</section>
    </div>
    <section className="panel"><h2>Últimas boletas</h2><Table rows={data.ultimosRemitos.map(formatRemitoRow)} cols={[["numero", "Nro"], ["cliente.nombre", "Cliente"], ["totalFmt", "Total"], ["pagoEstado", "Pago"], ["estado", "Estado"]]} /></section>
  </>;
}

function ProductsView({ api, canWrite, isAdmin }: { api: ReturnType<typeof useApi>; canWrite: boolean; isAdmin: boolean }) {
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

function ClientsView({ api, canWrite, canEditBalance }: { api: ReturnType<typeof useApi>; canWrite: boolean; canEditBalance: boolean }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const load = (term = q) => api(`/clientes?${qs({ q: term, pageSize: 100 })}`).then((d) => setClients(d.items));
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
      await load();
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
      await load();
      await reloadSelected(selectedClient.id);
    } catch (err: any) {
      setError(err.message ?? "No se pudo actualizar el cliente");
    }
  }
  async function openClientRemitoPdf(remito: any) {
    setError("");
    try {
      const blob = await api(`/remitos/${remito.id}/pdf`, { headers: { Accept: "application/pdf" } });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      setError(err.message ?? "No se pudo abrir el PDF");
    }
  }
  const clientRows = clients.map((client) => ({ ...client, saldoFmt: money(client.saldoPendiente), estadoFmt: client.activo ? "Activo" : "Inactivo" }));
  const totalSaldo = clients.reduce((sum, client) => sum + Number(client.saldoPendiente), 0);
  const activeCount = clients.filter((client) => client.activo).length;
  return <div className="client-page">
    <section className="client-overview">
      <Metric label="Clientes" value={String(clients.length)} />
      <Metric label="Activos" value={String(activeCount)} />
      <Metric label="Saldo total" value={money(totalSaldo)} />
    </section>
    <section className="panel wide client-list-panel">
      <div className="detail-head"><div><h2>Clientes</h2><span>Seleccioná un cliente para ver saldo, datos y boletas pendientes.</span></div></div>
      <SearchBox q={q} setQ={setQ} onSearch={(e) => { e?.preventDefault(); load(q); }} onClear={() => { setQ(""); load(""); }} placeholder="Buscar por nombre, empresa o email" />
      <div className="client-list">{clientRows.map((client) => <button type="button" className={`client-card ${selectedClient?.id === client.id ? "active" : ""}`} key={client.id} onClick={() => openClient(client)}><div><strong>{client.nombre}</strong><span>{client.empresa || "Consumidor final"}</span></div><div><span>Saldo</span><strong>{client.saldoFmt}</strong></div><small>{client.estadoFmt}</small></button>)}{!clientRows.length && <p className="muted">No hay clientes con esa búsqueda.</p>}</div>
    </section>
    {selectedClient && <ClientDetail client={selectedClient} canWrite={canWrite} canEditBalance={canEditBalance} onUpdate={updateClient} onClose={() => setSelectedClient(null)} onPdf={openClientRemitoPdf} />}
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
    <input name="nombre" defaultValue={client?.nombre} placeholder="Nombre" required />
    <input name="empresa" defaultValue={client?.empresa ?? ""} placeholder="Empresa" />
    <input name="telefono" defaultValue={client?.telefono ?? ""} placeholder="Teléfono" />
    <input name="email" type="email" defaultValue={client?.email ?? ""} placeholder="Email" />
    <input name="direccion" defaultValue={client?.direccion ?? ""} placeholder="Dirección" />
    <input name="observaciones" defaultValue={client?.observaciones ?? ""} placeholder="Observaciones" />
  </>;
}

function ClientDetail({ client, canWrite, canEditBalance, onUpdate, onClose, onPdf }: { client: Client; canWrite: boolean; canEditBalance: boolean; onUpdate: (event: React.FormEvent<HTMLFormElement>) => void; onClose: () => void; onPdf: (row: any) => void }) {
  const [editing, setEditing] = useState(false);
  const remitos = client.remitos ?? [];
  const activeRemitos = remitos.filter((r) => r.estado === "ACTIVO");
  const totalRemitos = activeRemitos.reduce((sum, r) => sum + Number(r.total), 0);
  const lastRemito = remitos[0];
  const remitoRows = [...remitos].sort((a, b) => {
    const debtA = Math.max(Number(a.total) - Number(a.montoPagado ?? 0), 0);
    const debtB = Math.max(Number(b.total) - Number(b.montoPagado ?? 0), 0);
    if (debtA !== debtB) return debtB - debtA;
    return Number(b.numero) - Number(a.numero);
  }).map(formatRemitoRow);
  const pendingRemitos = activeRemitos.filter((r) => Math.max(Number(r.total) - Number(r.montoPagado ?? 0), 0) > 0);
  return <section className="panel detail-panel client-profile">
    <div className="client-hero"><div><h2>{client.nombre}</h2><span>{client.empresa ?? "Sin empresa registrada"}</span></div><button type="button" className="icon-button" onClick={onClose} title="Cerrar detalle"><X size={18} /></button></div>
    <div className="detail-grid">
      <Metric label="Saldo pendiente" value={money(client.saldoPendiente)} /><Metric label="Boletas con deuda" value={String(pendingRemitos.length)} /><Metric label="Total vendido" value={money(totalRemitos)} /><Metric label="Última boleta" value={lastRemito ? `#${lastRemito.numero}` : "-"} />
    </div>
    <div className="client-info-grid">
      <InfoItem label="Estado" value={client.activo ? "Activo" : "Inactivo"} /><InfoItem label="Teléfono" value={client.telefono || "-"} /><InfoItem label="Email" value={client.email || "-"} /><InfoItem label="Dirección" value={client.direccion || "-"} />
    </div>
    <div className="client-remittances"><h3>Boletas del cliente</h3><span>Primero aparecen las que tienen saldo pendiente.</span><div className="client-remito-list">{remitoRows.map((row) => <ClientRemitoCard row={row} key={row.id} onPdf={onPdf} />)}{!remitoRows.length && <p className="muted">Este cliente todavía no tiene boletas.</p>}</div></div>
    {canWrite && <div className="client-edit-box"><button type="button" className="secondary" onClick={() => setEditing(!editing)}>{editing ? "Ocultar edición" : "Editar datos del cliente"}</button>{editing && <form className="form" onSubmit={onUpdate}><h3>Editar cliente</h3><ClientFields client={client} />{canEditBalance && <input name="saldoPendiente" type="number" step="0.01" min="0" defaultValue={Number(client.saldoPendiente)} placeholder="Saldo pendiente" />} {canEditBalance && <select name="activo" defaultValue={String(client.activo)}><option value="true">Activo</option><option value="false">Inactivo</option></select>}<button>Guardar cliente</button></form>}</div>}
  </section>;
}

function ClientRemitoCard({ row, onPdf }: { row: any; onPdf: (row: any) => void }) {
  const [open, setOpen] = useState(false);
  const pending = Math.max(Number(row.total) - Number(row.montoPagado ?? 0), 0);
  return <article className={`client-remito-card ${pending > 0 ? "pending" : ""}`}>
    <div><strong>Boleta #{row.numero}</strong><span>{row.fechaCorta} · {row.itemsCount} ítem{row.itemsCount === 1 ? "" : "s"}</span></div>
    <div className="sale-badges"><span className={`status-chip ${String(row.pagoEstado).toLowerCase()}`}>{row.pagoEstado}</span><span className={`status-chip ${String(row.estado).toLowerCase()}`}>{row.estado}</span></div>
    <div><strong>{row.totalFmt}</strong><span>Pagado {row.pagadoFmt} · pendiente {money(pending)}</span></div>
    <div className="client-remito-actions"><button type="button" className="secondary" onClick={() => setOpen(!open)}>{open ? "Ocultar" : "Ver detalle"}</button><button type="button" className="secondary" onClick={() => onPdf(row)}>PDF</button></div>
    {open && <div className="client-remito-detail"><div><strong>Vendedor</strong><span>{row.vendedor?.nombre ?? "Sin vendedor"}</span></div><div><strong>Productos</strong><span>{(row.items ?? []).map((item: any) => `${item.cantidad} x ${item.nombreProducto}`).join(" · ") || "-"}</span></div></div>}
  </article>;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div className="info-item"><span>{label}</span><strong>{value}</strong></div>;
}

function PurchasesView({ api, canWrite, isAdmin }: { api: ReturnType<typeof useApi>; canWrite: boolean; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [purchaseItems, setPurchaseItems] = useState<LineItem[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [filters, setFilters] = useState({ proveedor: "", productoId: "", fechaDesde: "", fechaHasta: "" });
  const [error, setError] = useState("");
  const load = (next = filters) => Promise.all([
    api(`/compras?${qs({ ...next, pageSize: 100 })}`),
    api("/productos?estado=ACTIVO&pageSize=100")
  ]).then(([c, p]) => { setItems(c.items); setProducts(p.items); });
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
      await api("/compras", { method: "POST", body: JSON.stringify({ proveedorNombre: form.proveedorNombre, fecha: form.fecha, items: purchaseItems.map((item) => ({ productoId: item.product.id, cantidad: item.cantidad, costoUnitario: item.costoUnitario ?? 0, actualizarCosto: item.actualizarCosto ?? true })) }) });
      formEl.reset();
      setSupplierName("");
      setPurchaseItems([]);
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo registrar la compra");
    }
  }
  const suppliers = Array.from(new Set(items.map((item) => String(item.proveedorNombre ?? "").trim()).filter(Boolean))).map((nombre) => ({ id: nombre, nombre }));
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
            <SupplierPicker suppliers={suppliers} value={supplierName} onChange={setSupplierName} />
            <input name="fecha" type="date" defaultValue={dateInput()} required />
          </form>
        </div>
        <div className="step-block">
          <span className="step-badge">2</span>
          <div className="purchase-add-line">
            <ProductPicker products={products} name="productoId" form="add-purchase-product" />
            <input name="cantidad" form="add-purchase-product" type="number" min="1" placeholder="Cantidad" required />
            <input name="costoUnitario" form="add-purchase-product" type="number" step="0.01" min="0" placeholder="Costo unitario" required />
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
  return <div className="detail-panel"><div className="detail-head"><div><h2>{purchase.proveedorNombre}</h2><span>{formatDate(purchase.fecha)} · {purchase.estado}</span></div><button type="button" className="icon-button" onClick={onClose} title="Cerrar detalle"><X size={18} /></button></div><Metric label="Total compra" value={money(purchase.total)} /><Table rows={rows} cols={[["productoNombre", "Producto"], ["cantidad", "Cantidad"], ["costoFmt", "Costo"], ["subtotalFmt", "Subtotal"], ["actualizarFmt", "Actualizó costo"]]} /></div>;
}

function SupplierPicker({ suppliers, value, onChange }: { suppliers: { id: string; nombre: string }[]; value: string; onChange: (value: string) => void }) {
  const selected = suppliers.find((supplier) => supplier.nombre === value);
  return <div className="supplier-picker">
    <input type="hidden" name="proveedorNombre" value={value} required />
    <EntityPicker items={suppliers} value={selected?.id ?? ""} onChange={(id) => onChange(suppliers.find((supplier) => supplier.id === id)?.nombre ?? "")} title="Elegir proveedor" placeholder="Elegir proveedor existente" searchPlaceholder="Buscar proveedor" getLabel={(supplier) => supplier.nombre} getMeta={() => "Proveedor usado en compras anteriores"} />
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="O escribir proveedor nuevo" required />
  </div>;
}

function RemittancesView({ api, canWrite }: { api: ReturnType<typeof useApi>; canWrite: boolean }) {
  const [remitos, setRemitos] = useState<any[]>([]);
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
  const load = (next = filters) => Promise.all([
    api(`/remitos?${qs({ ...next, pageSize: 100 })}`),
    api("/productos?estado=ACTIVO&pageSize=100"),
    api("/clientes?pageSize=100"),
    api("/vendedores?pageSize=100")
  ]).then(([r, p, c, v]) => { setRemitos(r.items); setProducts(p.items); setClients(c.items); setVendors(v.items); });
  useEffect(() => { load(); }, []);
  async function openRemito(row: any) {
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
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      setError(err.message ?? "No se pudo abrir el PDF");
    }
  }
  async function cancelRemito(row: any) {
    if (!confirmAction(`¿Cancelar la boleta #${row.numero}? Esta acción restaura el stock y no se puede deshacer.`)) return;
    try {
      await api(`/remitos/${row.id}/cancelar`, { method: "POST" });
      setSelected(null);
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo cancelar la boleta");
    }
  }
  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = payload(event.currentTarget);
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
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo editar la boleta");
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
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo crear la boleta");
    }
  }
  const activeClients = clients.filter((x) => x.activo);
  const activeVendors = vendors.filter((x) => x.activo);
  const subtotal = remitoItems.reduce((sum, item) => sum + item.cantidad * itemPrice(item.product, priceList), 0);
  const total = subtotal * (1 - Math.min(Math.max(descuentoPorcentaje, 0), 100) / 100);
  const remitoRows = remitos.map(formatRemitoRow);
  const totals = remitos.reduce((acc, remito) => {
    if (remito.estado === "ACTIVO") {
      acc.total += Number(remito.total);
      acc.paid += Number(remito.montoPagado ?? 0);
      if (remito.pagoEstado !== "PAGADA") acc.pending += Number(remito.total) - Number(remito.montoPagado ?? 0);
    }
    return acc;
  }, { total: 0, paid: 0, pending: 0 });
  return <div className="remitos-layout">
    <section className="sales-board">
      <div className="sales-summary">
        <Metric label="Boletas listadas" value={String(remitos.length)} />
        <Metric label="Total activo" value={money(totals.total)} />
        <Metric label="Cobrado" value={money(totals.paid)} />
        <Metric label="Pendiente" value={money(Math.max(totals.pending, 0))} />
      </div>
      <section className="panel sales-list-panel">
        <div className="detail-head sales-head"><div><h2>Boletas emitidas</h2><span>Buscá, revisá estado y abrí el detalle sin pelearte con una tabla enorme.</span></div>{canWrite && <button type="button" onClick={() => document.getElementById("crear-boleta")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Crear boleta</button>}</div>
        <form className="filters sales-filters" onSubmit={(e) => { e.preventDefault(); load(filters); }}>
          <input value={filters.numero} onChange={(e) => setFilters({ ...filters, numero: e.target.value })} placeholder="Nro" />
          <EntityPicker items={clients} value={filters.clienteId} onChange={(value) => setFilters({ ...filters, clienteId: value })} title="Elegir cliente" placeholder="Todos los clientes" searchPlaceholder="Buscar cliente" getLabel={(client) => client.nombre} getMeta={(client) => `${client.direccion ?? "Sin dirección"} · saldo ${money(client.saldoPendiente)}`} />
          <EntityPicker items={vendors} value={filters.vendedorId} onChange={(value) => setFilters({ ...filters, vendedorId: value })} title="Elegir vendedor" placeholder="Todos los vendedores" searchPlaceholder="Buscar vendedor" getLabel={(vendor) => vendor.nombre} getMeta={(vendor) => `${Number(vendor.porcentajeComision)}% comisión`} />
          <select value={filters.estado} onChange={(e) => setFilters({ ...filters, estado: e.target.value })}><option value="">Todos los estados</option><option value="ACTIVO">Activos</option><option value="CANCELADO">Cancelados</option></select>
          <select value={filters.pagoEstado} onChange={(e) => setFilters({ ...filters, pagoEstado: e.target.value })}><option value="">Todos los pagos</option><option value="PENDIENTE">Pendiente</option><option value="PARCIAL">Parcial</option><option value="PAGADA">Pagada</option></select>
          <input type="date" value={filters.fechaDesde} onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })} />
          <input type="date" value={filters.fechaHasta} onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })} />
          <button>Filtrar</button>
        </form>
        <div className="sales-list">{remitoRows.map((row) => <SaleCard key={row.id} row={row} onOpen={openRemito} onPdf={openPdf} onCancel={canWrite && row.estado === "ACTIVO" ? cancelRemito : undefined} />)}{!remitoRows.length && <p className="muted">No hay boletas con estos filtros.</p>}</div>
      </section>
    </section>
    {selected && <section className="panel detail-panel"><div className="detail-head"><div><h2>Boleta #{selected.numero}</h2><span>{selected.cliente?.nombre} · {selected.estado}</span></div><button type="button" className="icon-button" onClick={() => setSelected(null)} title="Cerrar detalle"><X size={18} /></button></div><div className="detail-grid"><Metric label="Fecha" value={formatDate(selected.fecha)} /><Metric label="Subtotal" value={money(selected.subtotal ?? selected.total)} /><Metric label="Descuento" value={`${Number(selected.descuentoPorcentaje ?? 0)}%`} /><Metric label="Total" value={money(selected.total)} /><Metric label="Pagado" value={money(selected.montoPagado)} /><Metric label="Pago" value={selected.pagoEstado} /><Metric label="Vendedor" value={selected.vendedor?.nombre ?? "-"} /><Metric label="Comisión" value={money(selected.vendedor ? Number(selected.total) * Number(selected.vendedor.porcentajeComision) / 100 : 0)} /></div><Table rows={(selected.items ?? []).map(formatRemitoItemRow)} cols={[["codigoProducto", "Código"], ["nombreProducto", "Producto"], ["cantidad", "Cantidad"], ["precioFmt", "Unitario"], ["subtotalFmt", "Subtotal"]]} />{canWrite && selected.estado === "ACTIVO" && <form className="form" onSubmit={saveEdit}><h3>Editar boleta</h3><div className="form-grid"><select name="vendedorId" defaultValue={selected.vendedorId ?? ""}><option value="">Sin vendedor</option>{activeVendors.map((v) => <option value={v.id} key={v.id}>{v.nombre} · {Number(v.porcentajeComision)}%</option>)}</select><select name="pagoEstado" defaultValue={selected.pagoEstado}><option value="PENDIENTE">Pendiente</option><option value="PARCIAL">Parcial</option><option value="PAGADA">Pagada</option></select><select name="metodoPago" defaultValue={selected.metodoPago ?? ""}><option value="">Sin método</option><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="TARJETA">Tarjeta</option><option value="CHEQUE">Cheque</option><option value="OTRO">Otro</option></select><input name="montoPagado" type="number" step="0.01" min="0" defaultValue={Number(selected.montoPagado)} placeholder="Monto pagado" /><input name="descuentoPorcentaje" type="number" step="0.01" min="0" max="100" defaultValue={Number(selected.descuentoPorcentaje ?? 0)} placeholder="% descuento" /></div><ItemList items={editItems} mode="remito" priceList={selected.listaPrecios} onRemove={(id) => setEditItems((current) => current.filter((item) => item.product.id !== id))} /><div className="add-line"><ProductPicker products={products} name="productoId" form="edit-remito-product" value={editProductId} onChange={setEditProductId} /><input name="cantidad" form="edit-remito-product" type="number" min="1" placeholder="Cantidad" required /><button type="submit" form="edit-remito-product">Agregar</button></div><Metric label="Nuevo subtotal" value={money(editItems.reduce((sum, item) => sum + item.cantidad * itemPrice(item.product, selected.listaPrecios), 0))} /><button>Guardar cambios</button></form>}<form id="edit-remito-product" onSubmit={addEditItem} /></section>}
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

function SaleCard({ row, onOpen, onPdf, onCancel }: { row: any; onOpen: (row: any) => void; onPdf: (row: any) => void; onCancel?: (row: any) => void }) {
  const pending = Math.max(Number(row.total) - Number(row.montoPagado ?? 0), 0);
  return <article className="sale-card">
    <button type="button" className="sale-main" onClick={() => onOpen(row)}>
      <div className="sale-title"><strong>Boleta #{row.numero}</strong><span>{row.fechaCorta}</span></div>
      <div className="sale-client"><strong>{row.cliente?.nombre ?? "Cliente"}</strong><span>{row.vendedor?.nombre ?? "Sin vendedor"}</span></div>
      <div className="sale-badges"><span className={`status-chip ${String(row.pagoEstado).toLowerCase()}`}>{row.pagoEstado}</span><span className={`status-chip ${String(row.estado).toLowerCase()}`}>{row.estado}</span></div>
      <div className="sale-money"><strong>{row.totalFmt}</strong><span>Pagado {row.pagadoFmt} · pendiente {money(pending)}</span></div>
    </button>
    <div className="sale-actions"><button type="button" className="secondary" onClick={() => onPdf(row)}>PDF</button>{onCancel && <button type="button" className="secondary" onClick={() => onCancel(row)}>Cancelar</button>}</div>
  </article>;
}

function StockView({ api, isAdmin }: { api: ReturnType<typeof useApi>; isAdmin: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filters, setFilters] = useState({ productoId: "", tipo: "", fechaDesde: "", fechaHasta: "" });
  const [error, setError] = useState("");
  const load = (next = filters) => Promise.all([
    api(`/stock/movimientos?${qs({ ...next, pageSize: 100 })}`),
    api("/productos?pageSize=100")
  ]).then(([movs, prods]) => { setRows(movs.items); setProducts(prods.items); });
  useEffect(() => { load(); }, []);
  async function adjust(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = payload(event.currentTarget);
    if (!confirmAction("¿Confirmar ajuste manual de stock?")) return;
    try {
      await api("/stock/ajustes", { method: "POST", body: JSON.stringify({ productoId: form.productoId, cantidadNueva: Number(form.cantidadNueva), motivo: form.motivo }) });
      event.currentTarget.reset();
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo ajustar el stock");
    }
  }
  return <div className="grid two">
    <section className="panel wide">
      <form className="filters filters-wide" onSubmit={(e) => { e.preventDefault(); load(filters); }}>
        <select value={filters.productoId} onChange={(e) => setFilters({ ...filters, productoId: e.target.value })}><option value="">Todos los productos</option>{products.map((p) => <option value={p.id} key={p.id}>{p.nombre}</option>)}</select>
        <select value={filters.tipo} onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}><option value="">Todos los movimientos</option><option value="COMPRA">Entradas por compra</option><option value="REMITO">Salidas por remito</option><option value="ALTA_PRODUCTO">Stock inicial</option><option value="CANCELACION_REMITO">Cancelaciones</option><option value="ANULACION_COMPRA">Anulación compra</option><option value="AJUSTE_MANUAL">Ajuste manual</option></select>
        <input type="date" value={filters.fechaDesde} onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })} />
        <input type="date" value={filters.fechaHasta} onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })} />
        <button>Filtrar</button><button type="button" className="secondary" onClick={() => { const clean = { productoId: "", tipo: "", fechaDesde: "", fechaHasta: "" }; setFilters(clean); load(clean); }}>Limpiar</button>
      </form>
      <div className="movement-list">{rows.map((row) => <StockMovement key={row.id} row={row} />)}{!rows.length && <p>No hay movimientos para estos filtros.</p>}</div>
    </section>
    <div className="stack">
      <section className="panel"><h2>Stock actual</h2>{products.map((p) => <Row key={p.id} title={p.nombre} meta={`${p.stockActual} unidades · mínimo ${p.stockMinimo}`} />)}</section>
      {isAdmin && <section className="panel"><h2>Ajuste manual</h2><form className="form" onSubmit={adjust}><select name="productoId" required><option value="">Producto</option>{products.map((p) => <option value={p.id} key={p.id}>{p.nombre} · actual {p.stockActual}</option>)}</select><input name="cantidadNueva" type="number" min="0" placeholder="Nueva cantidad" required /><input name="motivo" placeholder="Motivo del ajuste" required minLength={10} />{error && <p className="error">{error}</p>}<button>Registrar ajuste</button></form></section>}
    </div>
  </div>;
}

function StockMovement({ row }: { row: any }) {
  const entrada = row.cantidad > 0;
  const label = movementLabel(row.tipo);
  const date = new Date(row.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  return <div className={`movement ${entrada ? "in" : "out"}`}><div><strong>{row.producto?.nombre ?? "Producto"}</strong><span>{date} · {label}</span></div><div className="movement-numbers"><strong>{entrada ? "Entró" : "Salió"} {Math.abs(row.cantidad)}</strong><span>Quedaron {row.stockResultante}</span></div><small>{row.motivo || referenceLabel(row.referenciaTipo)}</small></div>;
}

function BalanceView({ api }: { api: ReturnType<typeof useApi> }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<any | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const load = () => Promise.all([api(`/dashboard/balance?year=${year}&month=${month}`), api("/dashboard")]).then(([balance, dash]) => { setData(balance); setDashboard(dash); });
  useEffect(() => { load(); }, []);
  if (!data || !dashboard) return <p>Cargando...</p>;
  return <div className="grid two"><section className="panel wide"><div className="filters"><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /><select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2026, i, 1).toLocaleString("es-AR", { month: "long" })}</option>)}</select><button onClick={load}>Ver período</button></div><div className="metrics"><Metric label="Ventas" value={money(data.ventas)} /><Metric label="Compras" value={money(data.compras)} /><Metric label="Resultado" value={money(data.resultado)} /><Metric label="Valor stock" value={money(data.valorStock)} /></div><h2>Comparativo últimos 6 meses</h2><ResponsiveContainer width="100%" height={320}><BarChart data={dashboard.chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis /><Tooltip /><Legend /><Bar dataKey="ventas" fill="#d71920" /><Bar dataKey="compras" fill="#2563eb" /></BarChart></ResponsiveContainer></section></div>;
}

function ReportsView({ api }: { api: ReturnType<typeof useApi> }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  async function download(kind: string, format: "pdf" | "xlsx") {
    const blob = await api(`/informes/${kind}?${qs({ year, month, format })}`, { headers: { Accept: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}.${format}`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  const reportRows = [
    ["clientes", "Clientes con saldos"],
    ["ventas", "Ventas del período"],
    ["compras", "Compras del período"],
    ["productos", "Productos y stock"]
  ];
  return <div className="grid two">
    <section className="panel wide">
      <h2>Informes</h2>
      <div className="filters">
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2026, i, 1).toLocaleString("es-AR", { month: "long" })}</option>)}</select>
      </div>
      <div className="report-list">{reportRows.map(([kind, label]) => <div className="report-row" key={kind}><strong>{label}</strong><div className="table-actions"><button type="button" className="secondary" onClick={() => download(kind, "pdf")}>PDF</button><button type="button" className="secondary" onClick={() => download(kind, "xlsx")}>Excel</button></div></div>)}</div>
    </section>
  </div>;
}

function VendorsView({ api }: { api: ReturnType<typeof useApi> }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorModal, setVendorModal] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState("");
  const loadVendors = () => api("/vendedores?pageSize=100").then((d) => setVendors(d.items));
  useEffect(() => { loadVendors(); }, []);
  async function createVendor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = payload(formEl);
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
    try {
      await api(`/vendedores/${selectedVendor.id}`, { method: "PATCH", body: JSON.stringify({ nombre: form.nombre, porcentajeComision: Number(form.porcentajeComision), activo: form.activo === "true" }) });
      setSelectedVendor(null);
      setVendorModal(null);
      await loadVendors();
    } catch (err: any) {
      setError(err.message ?? "No se pudo actualizar el vendedor");
    }
  }
  const activeCount = vendors.filter((vendor) => vendor.activo).length;
  return <div className="client-page">
    <section className="panel vendor-panel wide">
      <div className="detail-head"><div><h2>Vendedores</h2><span>{activeCount} activos · comisiones aplicadas en ventas.</span></div><button type="button" onClick={() => { setError(""); setSelectedVendor(null); setVendorModal("create"); }}>Nuevo vendedor</button></div>
      <div className="vendor-list vendor-list-grid">{vendors.map((vendor) => <button type="button" className="vendor-card" key={vendor.id} onClick={() => { setError(""); setSelectedVendor(vendor); setVendorModal("edit"); }}><div><strong>{vendor.nombre}</strong><span>{vendor.activo ? "Activo" : "Inactivo"}</span></div><strong>{Number(vendor.porcentajeComision)}%</strong></button>)}{!vendors.length && <p className="muted">No hay vendedores cargados.</p>}</div>
    </section>
    {vendorModal === "create" && <VendorModal title="Nuevo vendedor" onClose={() => setVendorModal(null)} onSubmit={createVendor} error={error} />}
    {vendorModal === "edit" && selectedVendor && <VendorModal title="Editar vendedor" vendor={selectedVendor} onClose={() => { setVendorModal(null); setSelectedVendor(null); }} onSubmit={updateVendor} error={error} />}
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

function UsersView({ api }: { api: ReturnType<typeof useApi> }) {
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [error, setError] = useState("");
  const load = () => api("/users?pageSize=100").then((d) => setUsers(d.items));
  useEffect(() => { load(); }, []);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    try {
      const form = payload(formEl);
      await api("/users", { method: "POST", body: JSON.stringify({ nombre: form.nombre, email: form.email, password: form.password, rol: form.rol }) });
      formEl.reset();
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo crear el usuario");
    }
  }
  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    try {
      const form = payload(event.currentTarget);
      await api(`/users/${selected.id}`, { method: "PATCH", body: JSON.stringify({ nombre: form.nombre, email: form.email, password: form.password || undefined, rol: form.rol, activo: form.activo === "true" }) });
      setSelected(null);
      await load();
    } catch (err: any) {
      setError(err.message ?? "No se pudo actualizar el usuario");
    }
  }
  const rows = users.map((u) => ({ ...u, estadoFmt: u.activo ? "Activo" : "Inactivo" }));
  return <div className="grid two"><section className="panel wide"><Table rows={rows} cols={[["nombre", "Nombre"], ["email", "Email"], ["rol", "Rol"], ["estadoFmt", "Estado"]]} onRowClick={setSelected} /></section><div className="stack">{selected && <section className="panel"><h2>Editar usuario</h2><form className="form" onSubmit={update}><UserFields user={selected} /><input name="password" type="password" placeholder="Nueva contraseña opcional" /><select name="activo" defaultValue={String(selected.activo)}><option value="true">Activo</option><option value="false">Inactivo</option></select><button>Guardar usuario</button></form></section>}<section className="panel"><h2>Nuevo usuario</h2><form className="form" onSubmit={create}><UserFields /><input name="password" type="password" placeholder="Contraseña" required minLength={8} />{error && <p className="error">{error}</p>}<button>Crear usuario</button></form></section></div></div>;
}

function UserFields({ user }: { user?: User }) {
  return <><input name="nombre" defaultValue={user?.nombre} placeholder="Nombre" required /><input name="email" type="email" defaultValue={user?.email} placeholder="Email" required /><select name="rol" defaultValue={user?.rol ?? "EMPLEADO"}><option value="ADMINISTRADOR">Administrador</option><option value="EMPLEADO">Empleado</option><option value="CONSULTA">Consulta</option></select></>;
}

function FilterPanel({ filters, setFilters, products, onSubmit, onClear }: { filters: { proveedor: string; productoId: string; fechaDesde: string; fechaHasta: string }; setFilters: (v: any) => void; products: Product[]; onSubmit: (e: React.FormEvent) => void; onClear: () => void }) {
  return <form className="filters filters-wide" onSubmit={onSubmit}><input value={filters.proveedor} onChange={(e) => setFilters({ ...filters, proveedor: e.target.value })} placeholder="Proveedor" /><select value={filters.productoId} onChange={(e) => setFilters({ ...filters, productoId: e.target.value })}><option value="">Todos los productos</option>{products.map((p) => <option value={p.id} key={p.id}>{p.nombre}</option>)}</select><input type="date" value={filters.fechaDesde} onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })} /><input type="date" value={filters.fechaHasta} onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })} /><button>Filtrar</button><button type="button" className="secondary" onClick={onClear}>Limpiar</button></form>;
}

function itemPrice(product: Product, list: "MAYORISTA" | "MINORISTA") {
  return Number(list === "MAYORISTA" ? product.precioMayorista : product.precioMinorista);
}

function EntityPicker<T extends { id: string }>({ items, value, onChange, name, form, title, placeholder, searchPlaceholder, getLabel, getMeta, required = false }: { items: T[]; value: string; onChange: (value: string) => void; name?: string; form?: string; title: string; placeholder: string; searchPlaceholder: string; getLabel: (item: T) => string; getMeta?: (item: T) => string; required?: boolean }) {
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
    {open && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="selector-modal">
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
          {visibleItems.map((item) => <button type="button" className="selector-row" key={item.id} onClick={() => choose(item.id)}><strong>{getLabel(item)}</strong>{getMeta && <span>{getMeta(item)}</span>}</button>)}
          {!visibleItems.length && <p className="muted empty-selector">No hay resultados.</p>}
        </div>
      </div>
    </div>}
  </div>;
}

function ProductPicker({ products, name, form, value, onChange }: { products: Product[]; name: string; form?: string; value?: string; onChange?: (value: string) => void }) {
  const [internalValue, setInternalValue] = useState("");
  return <EntityPicker items={products} value={value ?? internalValue} onChange={onChange ?? setInternalValue} name={name} form={form} title="Elegir producto" placeholder="Elegir producto" searchPlaceholder="Buscar por código, nombre o rubro" getLabel={(product) => product.nombre} getMeta={(product) => `${product.codigoInterno} · stock ${product.stockActual} · ${product.categoria?.nombre ?? "Sin rubro"}`} required />;
}

function ItemList({ items, mode, onRemove, priceList }: { items: LineItem[]; mode: "compra" | "remito"; onRemove: (productId: string) => void; priceList?: "MAYORISTA" | "MINORISTA" }) {
  if (!items.length) return <p className="muted">Todavía no agregaste productos.</p>;
  return <div className="line-items">{items.map((item) => { const unit = mode === "compra" ? item.costoUnitario ?? 0 : itemPrice(item.product, priceList ?? "MAYORISTA"); return <div className="line-item" key={item.product.id}><div><strong>{item.product.nombre}</strong><span>{item.product.codigoInterno} · cant. {item.cantidad} · unit. {money(unit)}{mode === "compra" ? ` · actualiza costo ${item.actualizarCosto === false ? "no" : "sí"}` : ""}</span></div><strong>{money(item.cantidad * unit)}</strong><button type="button" className="icon-button" onClick={() => onRemove(item.product.id)} title="Quitar producto"><Trash2 size={17} /></button></div>; })}</div>;
}

function movementLabel(type: string) {
  const labels: Record<string, string> = { COMPRA: "Compra cargada", REMITO: "Remito emitido", CANCELACION_REMITO: "Remito cancelado", ANULACION_COMPRA: "Compra anulada", AJUSTE_MANUAL: "Ajuste manual", ALTA_PRODUCTO: "Stock inicial", CAMBIO_COSTO: "Cambio de costo" };
  return labels[type] ?? type;
}

function referenceLabel(reference?: string) {
  if (reference === "Compra") return "Movimiento generado por una compra";
  if (reference === "Remito") return "Movimiento generado por un remito";
  return "Movimiento de stock";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR");
}

function formatRemitoRow(r: any) {
  return { ...r, fechaCorta: formatDate(r.fecha), totalFmt: money(r.total), pagadoFmt: money(r.montoPagado ?? 0), itemsCount: r.items?.length ?? 0 };
}

function formatRemitoItemRow(item: any) {
  return { ...item, precioFmt: money(item.precioUnitario), subtotalFmt: money(item.subtotal) };
}

function formatPurchaseRow(row: any) {
  return { ...row, fechaCorta: formatDate(row.fecha), totalFmt: money(row.total), itemsCount: row.items?.length ?? 0 };
}

function formatMovementRow(row: any) {
  return { ...row, createdFmt: new Date(row.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }), tipoFmt: movementLabel(row.tipo) };
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function Row({ title, meta }: { title: string; meta: string }) {
  return <div className="row"><strong>{title}</strong><span>{meta}</span></div>;
}

function SearchBox({ q, setQ, onSearch, onClear, placeholder = "Buscar" }: { q: string; setQ: (v: string) => void; onSearch: (event?: React.FormEvent) => void; onClear: () => void; placeholder?: string }) {
  return <form className="search" onSubmit={onSearch}><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} /><button type="submit">Filtrar</button>{q && <button type="button" className="secondary" onClick={onClear}>Limpiar</button>}</form>;
}

function get(row: any, key: string) {
  return key.split(".").reduce((v, k) => v?.[k], row);
}

function Table({ rows, cols, onRowClick, actions }: { rows: any[]; cols: [string, string][]; onRowClick?: (row: any) => void; actions?: (row: any) => React.ReactNode }) {
  return <div className="table-wrap"><table><thead><tr>{cols.map(([, label]) => <th key={label}>{label}</th>)}{actions && <th>Acciones</th>}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id ?? i} className={onRowClick ? "clickable-row" : undefined} onClick={() => onRowClick?.(row)}>{cols.map(([key]) => <td key={key}>{String(get(row, key) ?? "-").slice(0, 90)}</td>)}{actions && <td onClick={(event) => event.stopPropagation()}>{actions(row)}</td>}</tr>)}</tbody></table>{!rows.length && <p>No hay registros.</p>}</div>;
}

createRoot(document.getElementById("root")!).render(<App />);
