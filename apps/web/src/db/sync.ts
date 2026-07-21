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
  getLastSync,
} from "../db/index";

// ── Pre-carga ──────────────────────────────────────────────

/** Descarga todo el catálogo offline (productos, clientes, categorías, vendedores, dashboard).
 *  Llama a esta función al iniciar la app si hay conexión. */
export async function preloadOfflineData(
  api: (path: string, init?: RequestInit) => Promise<any>
) {
  // Disparamos todas las requests en paralelo (silenciamos errores
  // individuales para que si una falla no bloquee al resto).
  const results = await Promise.allSettled([
    api("/productos?limit=5000").catch(() => null),
    api("/clientes?limit=5000").catch(() => null),
    api("/categorias").catch(() => null),
    api("/vendedores").catch(() => null),
    api("/dashboard").catch(() => null),
  ]);

  const [productos, clientes, categorias, vendedores, dashboard] = results;

  const ops: Promise<void>[] = [];

  if (productos.status === "fulfilled" && productos.value) {
    const data = Array.isArray(productos.value) ? productos.value : productos.value.data ?? [];
    ops.push(cacheProducts(data));
  }
  if (clientes.status === "fulfilled" && clientes.value) {
    const data = Array.isArray(clientes.value) ? clientes.value : clientes.value.data ?? [];
    ops.push(cacheClients(data));
  }
  if (categorias.status === "fulfilled" && categorias.value) {
    const data = Array.isArray(categorias.value) ? categorias.value : categorias.value.data ?? [];
    ops.push(cacheCategories(data));
  }
  if (vendedores.status === "fulfilled" && vendedores.value) {
    const data = Array.isArray(vendedores.value) ? vendedores.value : vendedores.value.data ?? [];
    ops.push(cacheVendors(data));
  }
  if (dashboard.status === "fulfilled" && dashboard.value) {
    ops.push(cacheDashboard(dashboard.value));
  }

  await Promise.allSettled(ops);
}

// ── Helpers para api.ts ────────────────────────────────────

interface CacheFallbackMap {
  "/productos": () => Promise<any>;
  "/clientes": () => Promise<any>;
  "/categorias": () => Promise<any>;
  "/vendedores": () => Promise<any>;
  "/dashboard": () => Promise<any>;
}

/** Mapa de rutas GET → función que devuelve datos cacheados. */
const cacheMap: Record<string, () => Promise<any>> = {
  productos: async () => {
    const data = await getCachedProducts();
    return { data, total: data.length };
  },
  clientes: async () => {
    const data = await getCachedClients();
    return { data, total: data.length };
  },
  categorias: async () => {
    const data = await getCachedCategories();
    return { data, total: data.length };
  },
  vendedores: async () => {
    const data = await getCachedVendors();
    return { data, total: data.length };
  },
  dashboard: getCachedDashboard,
};

/** Intenta servir desde caché según la ruta. Devuelve null si no hay caché
 *  disponible para esa ruta. */
export async function getCachedFallback(path: string): Promise<any | null> {
  // Extraer la primera parte de la ruta: "/productos/123" → "productos"
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
