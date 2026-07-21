import Dexie, { type EntityTable } from "dexie";

export interface CachedProduct {
  id: string;
  codigoInterno: string;
  nombre: string;
  categoriaId?: string;
  categoria?: { id?: string; nombre: string };
  precioMayorista: string | number;
  precioMinorista: string | number;
  costo: string | number;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  movimientos?: any[];
}

export interface CachedClient {
  id: string;
  nombre: string;
  empresa?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  observaciones?: string;
  saldoPendiente: string | number;
  activo: boolean;
  remitos?: any[];
  pagos?: any[];
  historialImportado?: any[];
}

export interface CachedCategory {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface CachedVendor {
  id: string;
  nombre: string;
  porcentajeComision: string | number;
  activo: boolean;
}

export interface CachedDashboard {
  ventasMes: number;
  comprasMes: number;
  costoVendidoMes?: number;
  gastosMes?: number;
  gananciaBrutaMes?: number;
  balanceMes?: number;
  valorStock?: number;
  stockBajo: any[];
  ultimosRemitos: any[];
  chart: any[];
}

export interface ApiCacheEntry {
  key: string;
  path: string;
  data: any;
  lastSync: number;
}

export interface SyncMeta {
  collection: string;
  lastSync: number;
}

const db = new Dexie("perez_offline") as Dexie & {
  productos: EntityTable<CachedProduct, "id">;
  clientes: EntityTable<CachedClient, "id">;
  categorias: EntityTable<CachedCategory, "id">;
  vendedores: EntityTable<CachedVendor, "id">;
  dashboard: EntityTable<CachedDashboard & { _id: string }, "_id">;
  apiCache: EntityTable<ApiCacheEntry, "key">;
  syncMeta: EntityTable<SyncMeta, "collection">;
};

db.version(1).stores({
  productos: "id, codigoInterno, nombre, categoriaId, activo",
  clientes: "id, nombre, activo",
  categorias: "id, nombre, activo",
  vendedores: "id, nombre, activo",
  dashboard: "_id",
  syncMeta: "collection",
});

db.version(2).stores({
  productos: "id, codigoInterno, nombre, categoriaId, activo",
  clientes: "id, nombre, activo",
  categorias: "id, nombre, activo",
  vendedores: "id, nombre, activo",
  dashboard: "_id",
  apiCache: "key, path, lastSync",
  syncMeta: "collection",
});

async function markSynced(collection: string) {
  await db.syncMeta.put({ collection, lastSync: Date.now() });
}

export function normalizeApiCacheKey(path: string, scope = "global") {
  const [pathname, query = ""] = path.split("?");
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (!query) return `${scope}:${normalizedPath}`;
  const params = new URLSearchParams(query);
  const sorted = new URLSearchParams();
  Array.from(params.keys()).sort().forEach((key) => {
    for (const value of params.getAll(key)) sorted.append(key, value);
  });
  const qs = sorted.toString();
  return `${scope}:${qs ? `${normalizedPath}?${qs}` : normalizedPath}`;
}

export async function cacheApiResponse(path: string, data: any, scope = "global") {
  const key = normalizeApiCacheKey(path, scope);
  await db.apiCache.put({ key, path, data, lastSync: Date.now() });
  await markSynced(`api:${key}`);
}

export async function getCachedApiResponse(path: string, scope = "global") {
  const entry = await db.apiCache.get(normalizeApiCacheKey(path, scope));
  return entry?.data ?? null;
}

export async function cacheProducts(products: CachedProduct[]) {
  await db.transaction("rw", db.productos, async () => {
    await db.productos.clear();
    if (products.length) await db.productos.bulkPut(products);
  });
  await markSynced("productos");
}

export async function cacheClients(clients: CachedClient[]) {
  await db.transaction("rw", db.clientes, async () => {
    await db.clientes.clear();
    if (clients.length) await db.clientes.bulkPut(clients);
  });
  await markSynced("clientes");
}

export async function cacheCategories(categories: CachedCategory[]) {
  await db.transaction("rw", db.categorias, async () => {
    await db.categorias.clear();
    if (categories.length) await db.categorias.bulkPut(categories);
  });
  await markSynced("categorias");
}

export async function cacheVendors(vendors: CachedVendor[]) {
  await db.transaction("rw", db.vendedores, async () => {
    await db.vendedores.clear();
    if (vendors.length) await db.vendedores.bulkPut(vendors);
  });
  await markSynced("vendedores");
}

export async function cacheDashboard(data: CachedDashboard) {
  await db.transaction("rw", db.dashboard, async () => {
    await db.dashboard.clear();
    await db.dashboard.add({ ...data, _id: "snapshot" });
  });
  await markSynced("dashboard");
}

export async function getCachedProducts() {
  return db.productos.toArray();
}

export async function getCachedProduct(id: string) {
  return (await db.productos.get(id)) ?? null;
}

export async function getCachedClients() {
  return db.clientes.toArray();
}

export async function getCachedClient(id: string) {
  return (await db.clientes.get(id)) ?? null;
}

export async function getCachedCategories() {
  return db.categorias.toArray();
}

export async function getCachedVendors() {
  return db.vendedores.toArray();
}

export async function getCachedVendor(id: string) {
  return (await db.vendedores.get(id)) ?? null;
}

export async function getCachedDashboard() {
  const data = await db.dashboard.get("snapshot");
  if (!data) return null;
  const { _id, ...snapshot } = data;
  return snapshot;
}

export async function getLastSync(collection: string) {
  const meta = await db.syncMeta.get(collection);
  return meta?.lastSync ?? 0;
}

export async function hasOfflineData() {
  return (await db.productos.count()) > 0;
}

export { db };
