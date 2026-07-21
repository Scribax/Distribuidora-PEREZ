import {
  cacheProducts,
  cacheClients,
  cacheCategories,
  cacheVendors,
  cacheDashboard,
  getCachedProducts,
  getCachedClients,
  getCachedCategories,
  getCachedVendors,
  getCachedDashboard,
} from "./index";

// ── Pre-carga ──────────────────────────────────────────────

/** Descarga todo el catálogo offline (productos, clientes, categorías, vendedores, dashboard).
 *  Llama a esta función al iniciar la app si hay conexión. */
export async function preloadOfflineData(
  api: (path: string, init?: RequestInit) => Promise<any>
) {
  const results = await Promise.allSettled([
    api("/productos?limit=5000").catch(() => null),
    api("/clientes?limit=5000").catch(() => null),
    api("/categorias").catch(() => null),
    api("/vendedores").catch(() => null),
    api("/dashboard").catch(() => null),
  ]);

  const [productos, clientes, categorias, vendedores, dashboard] = results;

  const ops: Promise<void>[] = [];

  // La API devuelve { items, total, page, pageSize } para colecciones paginadas
  if (productos.status === "fulfilled" && productos.value) {
    const items = productos.value.items ?? [];
    ops.push(cacheProducts(items));
  }
  if (clientes.status === "fulfilled" && clientes.value) {
    const items = clientes.value.items ?? [];
    ops.push(cacheClients(items));
  }
  // categorias y vendedores devuelven array directo
  if (categorias.status === "fulfilled" && categorias.value) {
    const data = Array.isArray(categorias.value) ? categorias.value : [];
    ops.push(cacheCategories(data));
  }
  if (vendedores.status === "fulfilled" && vendedores.value) {
    const data = Array.isArray(vendedores.value) ? vendedores.value : [];
    ops.push(cacheVendors(data));
  }
  // dashboard devuelve el objeto directo
  if (dashboard.status === "fulfilled" && dashboard.value) {
    ops.push(cacheDashboard(dashboard.value));
  }

  await Promise.allSettled(ops);
}

// ── Helpers para api.ts ────────────────────────────────────

/** Mapa de rutas GET → función que devuelve datos cacheados con la
 *  MISMA forma que la API real para que las vistas no se rompan. */
const cacheMap: Record<string, () => Promise<any>> = {
  productos: async () => {
    const items = await getCachedProducts();
    return { items, total: items.length, page: 1, pageSize: items.length };
  },
  clientes: async () => {
    const items = await getCachedClients();
    return { items, total: items.length, page: 1, pageSize: items.length };
  },
  categorias: getCachedCategories,        // API devuelve array directo
  vendedores: getCachedVendors,           // API devuelve array directo
  dashboard: getCachedDashboard,          // API devuelve objeto directo
};

/** Intenta servir desde caché según la ruta. Devuelve null si no hay caché. */
export async function getCachedFallback(path: string): Promise<any | null> {
  const base = path.replace(/^\/+/, "").split("/")[0].split("?")[0];
  const fn = cacheMap[base];
  if (!fn) return null;
  try {
    return await fn();
  } catch {
    return null;
  }
}

/** Devuelve true si la ruta es cacheable (es una operación de solo lectura). */
export function isCacheablePath(path: string): boolean {
  const base = path.replace(/^\/+/, "").split("/")[0].split("?")[0];
  return base in cacheMap;
}
