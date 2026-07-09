import { useEffect, useState } from "react";
import { BarChart3, Boxes, Calculator, LogOut, Menu, Moon, PackagePlus, ReceiptText, ShoppingCart, Sun, UserCog, Users, X } from "lucide-react";
import { useApi } from "./api";
import { Login } from "./Login";
import { InstallButton } from "./components/InstallButton";
import type { Session } from "./types";
import { BalanceView, ClientsView, CommercialsView, DashboardView, ExpensesView, ProductsView, PurchasesView, RemittancesView, ReportsView, StockView, UsersView } from "./pages/index";

export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem("perez_session");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem("perez_session");
      return null;
    }
  });
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("perez_theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [view, setView] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const api = useApi(session, setSession);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("perez_theme", theme);
  }, [theme]);
  if (!session) return <Login onLogin={setSession} theme={theme} onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")} />;
  const nav = [
    ["dashboard", BarChart3, "Dashboard"],
    ["productos", Boxes, "Productos"],
    ["clientes", Users, "Clientes"],
    ["compras", ShoppingCart, "Compras"],
    ["remitos", ReceiptText, "Ventas"],
    ...(session.user.rol === "CONSULTA" ? [] : [["gastos", Calculator, "Gastos"] as const]),
    ...(session.user.rol === "CONSULTA" ? [] : [["balance", Calculator, "Balance"] as const]),
    ...(session.user.rol === "CONSULTA" ? [] : [["informes", BarChart3, "Informes"] as const]),
    ...(session.user.rol === "CONSULTA" ? [] : [["comerciales", UserCog, "Comerciales"] as const]),
    ["stock", PackagePlus, "Stock"],
    ...(session.user.rol === "ADMINISTRADOR" ? [["usuarios", UserCog, "Usuarios"] as const] : [])
  ] as const;
  const viewHelp: Record<string, string> = {
    dashboard: "Resumen del negocio y accesos rapidos",
    productos: "Alta, precios y catalogo de mercaderia",
    clientes: "Datos, saldos e historial de compradores",
    compras: "Ingreso de mercaderia y proveedores",
    remitos: "Carga de ventas, boletas y pagos",
    gastos: "Egresos operativos del mes",
    balance: "Caja, deudas y resultado general",
    informes: "Reportes y auditoria de movimientos",
    comerciales: "Vendedores, cuentas y comisiones",
    stock: "Existencias, minimos y ajustes",
    usuarios: "Permisos y cuentas del sistema"
  };
  const currentLabel = nav.find(([id]) => id === view)?.[2] ?? "Dashboard";
  const bottomNav = [
    ["dashboard", BarChart3, "Inicio"],
    ["remitos", ReceiptText, "Ventas"],
    ["clientes", Users, "Clientes"],
    ["stock", PackagePlus, "Stock"]
  ] as const;
  return <div className={`app ${navOpen ? "nav-open" : ""}`}>
    <button type="button" className="mobile-menu-button" onClick={() => setNavOpen(true)} title="Abrir menú"><Menu size={20} />Menú</button>
    {navOpen && <button type="button" className="nav-scrim" onClick={() => setNavOpen(false)} aria-label="Cerrar menú" />}
    <aside className={navOpen ? "open" : ""}>
      <div className="brand"><img src="/brand-logo-optimized.png" alt="Perez Martin Distribuidora" /><button type="button" className="nav-close" onClick={() => setNavOpen(false)} title="Cerrar menú"><X size={18} /></button></div>
      {nav.map(([id, Icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => { setView(id); setNavOpen(false); }} title={label}><Icon size={18} />{label}</button>)}
      <button className="theme-toggle" onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")} title={theme === "dark" ? "Modo claro" : "Modo oscuro"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}{theme === "dark" ? "Claro" : "Oscuro"}</button>
      <InstallButton />
      <button className="logout" onClick={() => { localStorage.removeItem("perez_session"); setSession(null); }}><LogOut size={18} />Salir</button>
    </aside>
    <section className="workspace">
      <header className="workspace-header">
        <div>
          <span className="eyebrow">Distribuidora Perez Martin</span>
          <h1>{currentLabel}</h1>
          <p>{viewHelp[view]}</p>
        </div>
        <span className="user-pill">{session.user.nombre} · {session.user.rol}</span>
      </header>
      {view === "dashboard" && <DashboardView api={api} onNavigate={setView} />}
      {view === "productos" && <ProductsView api={api} canWrite={session.user.rol !== "CONSULTA"} isAdmin={session.user.rol === "ADMINISTRADOR"} />}
      {view === "clientes" && <ClientsView api={api} canWrite={session.user.rol !== "CONSULTA"} canEditBalance={session.user.rol === "ADMINISTRADOR"} />}
      {view === "compras" && <PurchasesView api={api} canWrite={session.user.rol !== "CONSULTA"} isAdmin={session.user.rol === "ADMINISTRADOR"} />}
      {view === "remitos" && <RemittancesView api={api} canWrite={session.user.rol !== "CONSULTA"} isAdmin={session.user.rol === "ADMINISTRADOR"} />}
      {view === "gastos" && <ExpensesView api={api} isAdmin={session.user.rol === "ADMINISTRADOR"} />}
      {view === "balance" && <BalanceView api={api} />}
      {view === "informes" && <ReportsView api={api} />}
      {view === "comerciales" && <CommercialsView api={api} isAdmin={session.user.rol === "ADMINISTRADOR"} canWrite={session.user.rol !== "CONSULTA"} />}
      {view === "stock" && <StockView api={api} isAdmin={session.user.rol === "ADMINISTRADOR"} />}
      {view === "usuarios" && <UsersView api={api} />}
    </section>
    <nav className="mobile-bottom-nav" aria-label="Accesos rápidos">
      {bottomNav.map(([id, Icon, label]) => <button key={id} type="button" className={view === id ? "active" : ""} onClick={() => { setView(id); setNavOpen(false); }}>
        <Icon size={20} />
        <span>{label}</span>
      </button>)}
    </nav>
  </div>;
}
