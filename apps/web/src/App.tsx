import { useEffect, useState } from "react";
import { BarChart3, Boxes, Calculator, CalendarClock, FileText, LogOut, Megaphone, Menu, Moon, PackagePlus, ReceiptText, ShoppingCart, Sun, UserCog, Users, X } from "lucide-react";
import { useApi } from "./api";
import { Login } from "./Login";
import type { Session } from "./types";
import { BalanceView, ClientsView, CommercialsView, DashboardView, ExpensesView, ProductsView, PurchasesView, QuotesView, RemittancesView, ReportsView, StockView, UpdatesView, UsersView } from "./pages/index";
import { SyncStatus, OnlinePill } from "./components/SyncStatus";
import { preloadOfflineData } from "./db/sync";
import { useOfflineQueue } from "./hooks/useOfflineQueue";

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
  const offlineQueue = useOfflineQueue(session);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("perez_theme", theme);
  }, [theme]);

  // ── Precarga de datos offline al iniciar sesión ──────────
  useEffect(() => {
    if (!session || !navigator.onLine) return;
    preloadOfflineData(api).catch(() => {
      // Silencioso — si falla la precarga, los datos se cachean
      // en la próxima navegación con internet.
    });
  }, [session]);

  if (!session) return <Login onLogin={setSession} theme={theme} onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")} />;
  const nav = [
    ["dashboard", BarChart3, "Dashboard"],
    ["productos", Boxes, "Productos"],
    ["clientes", Users, "Clientes"],
    ["compras", ShoppingCart, "Compras"],
    ["remitos", ReceiptText, "Ventas"],
    ...(session.user.rol === "CONSULTA" ? [] : [["cotizaciones", FileText, "Cotizaciones"] as const]),
    ...(session.user.rol === "CONSULTA" ? [] : [["gastos", Calculator, "Gastos"] as const]),
    ...(session.user.rol === "CONSULTA" ? [] : [["balance", Calculator, "Balance"] as const]),
    ...(session.user.rol === "CONSULTA" ? [] : [["informes", BarChart3, "Informes"] as const]),
    ...(session.user.rol === "CONSULTA" ? [] : [["comerciales", UserCog, "Comerciales"] as const]),
    ["stock", PackagePlus, "Stock"],
    ["actualizaciones", Megaphone, "Novedades"],
    ...(session.user.rol === "ADMINISTRADOR" ? [["usuarios", UserCog, "Usuarios"] as const] : []),
  ] as const;
  const viewHelp: Record<string, string> = {
    dashboard: "Resumen del negocio y accesos rapidos",
    productos: "Alta, precios y catalogo de mercaderia",
    clientes: "Datos, saldos e historial de compradores",
    compras: "Ingreso de mercaderia y proveedores",
    remitos: "Carga de ventas, boletas y pagos",
    cotizaciones: "Presupuestos sin afectar stock ni saldo",
    gastos: "Egresos operativos del mes",
    balance: "Caja, deudas y resultado general",
    informes: "Reportes y auditoria de movimientos",
    comerciales: "Vendedores, cuentas y comisiones",
    stock: "Existencias, minimos y ajustes",
    actualizaciones: "Novedades y mejoras del sistema",
    usuarios: "Permisos y cuentas del sistema",
  };
  const currentLabel = nav.find(([id]) => id === view)?.[2] ?? "Dashboard";
  const maintenance = getMaintenanceStatus();
  const bottomNav = [
    ["dashboard", BarChart3, "Inicio"],
    ["remitos", ReceiptText, "Ventas"],
    ["clientes", Users, "Clientes"],
    ["stock", PackagePlus, "Stock"],
  ] as const;
  return (
    <div className={`app ${navOpen ? "nav-open" : ""}`}>
      <button type="button" className="mobile-menu-button" onClick={() => setNavOpen(true)} title="Abrir menú">
        <Menu size={20} />
        Menú
      </button>
      {navOpen && <button type="button" className="nav-scrim" onClick={() => setNavOpen(false)} aria-label="Cerrar menú" />}
      <aside className={navOpen ? "open" : ""}>
        <div className="brand">
          <img src="/brand-logo-optimized.png" alt="Perez Martin Distribuidora" />
          <button type="button" className="nav-close" onClick={() => setNavOpen(false)} title="Cerrar menú">
            <X size={18} />
          </button>
        </div>
        {nav.map(([id, Icon, label]) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => {
              setView(id);
              setNavOpen(false);
            }}
            title={label}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-pressed={theme === "dark"}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          <span>{theme === "dark" ? "Claro" : "Oscuro"}</span>
          <span className={`theme-switch ${theme}`} aria-hidden="true">
            <span />
          </span>
        </button>
        <button
          className="logout"
          onClick={() => {
            localStorage.removeItem("perez_session");
            setSession(null);
          }}
        >
          <LogOut size={18} />
          Salir
        </button>
      </aside>
      <section className="workspace">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">Distribuidora Perez Martin</span>
            <h1>{currentLabel}</h1>
            <p>{viewHelp[view]}</p>
          </div>
          <div className="workspace-actions">
            <OnlinePill pending={offlineQueue.pending} conflicts={offlineQueue.conflicts} syncing={offlineQueue.syncing} />
            <span className={`maintenance-pill ${maintenance.daysLeft <= 3 ? "soon" : ""}`} title={`Próximo mantenimiento: ${maintenance.dueFull}`}>
              <CalendarClock size={16} />
              <span>Mantenimiento</span>
              <strong>{maintenance.shortText}</strong>
            </span>
            <span className="user-pill">
              {session.user.nombre} · {session.user.rol}
            </span>
          </div>
        </header>
        {view === "dashboard" && <DashboardView api={api} onNavigate={setView} />}
        {view === "productos" && <ProductsView api={api} canWrite={session.user.rol !== "CONSULTA"} isAdmin={session.user.rol === "ADMINISTRADOR"} />}
        {view === "clientes" && <ClientsView api={api} canWrite={session.user.rol !== "CONSULTA"} canEditBalance={session.user.rol === "ADMINISTRADOR"} />}
        {view === "compras" && <PurchasesView api={api} canWrite={session.user.rol !== "CONSULTA"} isAdmin={session.user.rol === "ADMINISTRADOR"} />}
        {view === "remitos" && <RemittancesView api={api} canWrite={session.user.rol !== "CONSULTA"} isAdmin={session.user.rol === "ADMINISTRADOR"} offlineScope={offlineQueue.scope} />}
        {view === "cotizaciones" && <QuotesView api={api} canWrite={session.user.rol !== "CONSULTA"} />}
        {view === "gastos" && <ExpensesView api={api} isAdmin={session.user.rol === "ADMINISTRADOR"} />}
        {view === "balance" && <BalanceView api={api} />}
        {view === "informes" && <ReportsView api={api} />}
        {view === "comerciales" && <CommercialsView api={api} isAdmin={session.user.rol === "ADMINISTRADOR"} canWrite={session.user.rol !== "CONSULTA"} />}
        {view === "stock" && <StockView api={api} isAdmin={session.user.rol === "ADMINISTRADOR"} />}
        {view === "actualizaciones" && <UpdatesView />}
        {view === "usuarios" && <UsersView api={api} />}
      </section>
      <nav className="mobile-bottom-nav" aria-label="Accesos rápidos">
        {bottomNav.map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "active" : ""}
            onClick={() => {
              setView(id);
              setNavOpen(false);
            }}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Indicador de conectividad */}
      <SyncStatus pending={offlineQueue.pending} conflicts={offlineQueue.conflicts} syncing={offlineQueue.syncing} onSync={offlineQueue.syncNow} />
    </div>
  );
}

function getMaintenanceStatus() {
  const start = parseLocalDate(import.meta.env.VITE_MAINTENANCE_START_DATE ?? "2026-07-01");
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let dueDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (dueDate < todayDate) {
    dueDate = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, start.getDate());
  }
  const daysLeft = Math.round((dueDate.getTime() - todayDate.getTime()) / 86_400_000);
  const dueShort = dueDate.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  const dueFull = dueDate.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const remaining = daysLeft === 0 ? "vence hoy" : daysLeft === 1 ? "falta 1 día" : `faltan ${daysLeft} días`;
  return { daysLeft, dueFull, shortText: `${dueShort} · ${remaining}` };
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(2026, 6, 1);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
