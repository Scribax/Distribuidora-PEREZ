import {
  cacheApiResponse,
  cacheProducts,
  cacheClients,
  cacheCategories,
  cacheVendors,
  cacheDashboard,
  getCachedApiResponse,
  getCachedProducts,
  getCachedProduct,
  getCachedClients,
  getCachedClient,
  getCachedCategories,
  getCachedVendors,
  getCachedVendor,
} from "./index";

const STATIC_PRELOAD_PATHS = [
  "/dashboard",
  "/productos?pageSize=1000",
  "/productos?estado=ACTIVO&pageSize=1000",
  "/clientes?pageSize=1000",
  "/categorias",
  "/vendedores?pageSize=1000",
  "/proveedores?pageSize=1000",
  "/compras?pageSize=100",
  "/remitos?pageSize=100",
  "/gastos?pageSize=100",
  "/stock/stats",
  "/stock/movimientos?pageSize=100",
  "/users?pageSize=100",
  "/informes/auditoria?page=1&pageSize=20",
] as const;

function preloadPaths() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return [
    ...STATIC_PRELOAD_PATHS,
    `/dashboard/balance?year=${year}&month=${month}`,
    `/dashboard/caja?year=${year}&month=${month}`,
  ];
}

function asItems(value: any) {
  return Array.isArray(value) ? value : value?.items ?? [];
}

function isUnfilteredCollectionPath(path: string) {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  const allowed = new Set(["page", "pageSize"]);
  return { pathname, unfiltered: Array.from(params.keys()).every((key) => allowed.has(key)) };
}

async function persistKnownCollections(path: string, data: any) {
  const { pathname, unfiltered } = isUnfilteredCollectionPath(path);
  const items = asItems(data);

  if (pathname === "/productos" && unfiltered && Array.isArray(items)) await cacheProducts(items);
  if (pathname === "/clientes" && unfiltered && Array.isArray(items)) await cacheClients(items);
  if (pathname === "/categorias" && Array.isArray(data)) await cacheCategories(data);
  if (pathname === "/vendedores" && unfiltered && Array.isArray(items)) await cacheVendors(items);
  if (pathname === "/dashboard" && data && !Array.isArray(data)) await cacheDashboard(data);
}

export async function cacheSuccessfulGet(path: string, data: any, scope?: string) {
  await Promise.allSettled([
    cacheApiResponse(path, data, scope),
    persistKnownCollections(path, data),
  ]);
}

/** Descarga las pantallas principales para uso offline de solo lectura. */
export async function preloadOfflineData(
  api: (path: string, init?: RequestInit) => Promise<any>
) {
  await Promise.allSettled(preloadPaths().map((path) => api(path).catch(() => null)));
}

function paginate(items: any[], path: string) {
  const [, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const pageSize = Math.max(1, Number(params.get("pageSize") ?? items.length) || 1);
  const total = items.length;
  const sliced = items.slice((page - 1) * pageSize, page * pageSize);
  return { items: sliced, total, page, pageSize };
}

function filterProducts(items: any[], path: string) {
  const [, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const estado = params.get("estado") ?? "";
  const categoriaId = params.get("categoriaId") ?? "";
  const filtered = items.filter((p) => {
    const matchesQ = !q || [p.nombre, p.codigoInterno, p.categoria?.nombre].some((v) => String(v ?? "").toLowerCase().includes(q));
    const matchesEstado = estado === "ACTIVO" ? p.activo : estado === "INACTIVO" ? !p.activo : true;
    const matchesCategoria = !categoriaId || p.categoriaId === categoriaId;
    return matchesQ && matchesEstado && matchesCategoria;
  });
  return paginate(filtered, path);
}

function filterClients(items: any[], path: string) {
  const [, query = ""] = path.split("?");
  const q = (new URLSearchParams(query).get("q") ?? "").trim().toLowerCase();
  const filtered = q
    ? items.filter((c) => [c.nombre, c.empresa, c.email].some((v) => String(v ?? "").toLowerCase().includes(q)))
    : items;
  return paginate(filtered, path);
}

async function fallbackByCollection(path: string) {
  const pathname = path.split("?")[0];
  const parts = pathname.replace(/^\/+/, "").split("/");
  const [base, id] = parts;

  if (base === "productos" && id) return getCachedProduct(id);
  if (base === "clientes" && id) return getCachedClient(id);
  if (base === "vendedores" && id) return getCachedVendor(id);
  if (pathname === "/productos") return filterProducts(await getCachedProducts(), path);
  if (pathname === "/clientes") return filterClients(await getCachedClients(), path);
  if (pathname === "/categorias") return getCachedCategories();
  if (pathname === "/vendedores") return paginate(await getCachedVendors(), path);
  return null;
}

/** Intenta servir desde caché exacta y, si no existe, desde colecciones base. */
export async function getCachedFallback(path: string, scope?: string): Promise<any | null> {
  try {
    const exact = await getCachedApiResponse(path, scope);
    if (exact != null) return exact;
    return await fallbackByCollection(path);
  } catch {
    return null;
  }
}

export function isCacheablePath(path: string): boolean {
  return !path.includes("/pdf") && !path.includes("format=pdf") && !path.includes("format=xlsx");
}
