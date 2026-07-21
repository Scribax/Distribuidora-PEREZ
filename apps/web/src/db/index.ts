import Dexie, { type EntityTable } from "dexie";

// ── Tipos para los datos cacheados ──────────────────────────

export interface CachedProduct {
  id: string;
  codigoInterno: string;
  nombre: string;
  categoriaId: string;
  categoriaNombre: string;
  precioMayorista: number;
  precioMinorista: number;
  costo: number;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
}

export interface CachedClient {
  id: string;
  nombre: string;
  empresa?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  saldoPendiente: number;
  activo: boolean;
}

export interface CachedCategory {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface CachedVendor {
  id: string;
  nombre: string;
  porcentajeComision: number;
  activo: boolean;
}

export interface CachedDashboard {
  ventasMes: number;
  comprasMes: number;
  balanceMes: number;
  valorStock: number;
  stockBajo: Array<{
    id: string;
    nombre: string;
    stockActual: number;
    stockMinimo: number;
  }>;
  ultimosRemitos: Array<{
    numero: number;
    cliente: string;
    fecha: string;
    total: number;
    estado: string;
  }>;
  grafico: Array<{
    mes: string;
    ventas: number;
    compras: number;
  }>;
}

export interface SyncMeta {
  collection: string;
  lastSync: number; // Date.now()
}

// ── Base de datos Dexie ─────────────────────────────────────

const db = new Dexie("perez_offline") as Dexie & {
  productos: EntityTable<CachedProduct, "id">;
  clientes: EntityTable<CachedClient, "id">;
  categorias: EntityTable<CachedCategory, "id">;
  vendedores: EntityTable<CachedVendor, "id">;
  dashboard: EntityTable<CachedDashboard & { _id: string }, "_id">;
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

// ── Operaciones de caché ────────────────────────────────────

/** Reemplaza toda la colección de productos en la caché local. */
export async function cacheProducts(products: CachedProduct[]) {
  await db.transaction("rw", db.productos, async () => {
    await db.productos.clear();
    await db.productos.bulkAdd(products);
  });
  await db.syncMeta.put({ collection: "productos", lastSync: Date.now() });
}

/** Reemplaza toda la colección de clientes en la caché local. */
export async function cacheClients(clients: CachedClient[]) {
  await db.transaction("rw", db.clientes, async () => {
    await db.clientes.clear();
    await db.clientes.bulkAdd(clients);
  });
  await db.syncMeta.put({ collection: "clientes", lastSync: Date.now() });
}

/** Reemplaza las categorías en caché. */
export async function cacheCategories(categories: CachedCategory[]) {
  await db.transaction("rw", db.categorias, async () => {
    await db.categorias.clear();
    await db.categorias.bulkAdd(categories);
  });
  await db.syncMeta.put({ collection: "categorias", lastSync: Date.now() });
}

/** Reemplaza los vendedores en caché. */
export async function cacheVendors(vendors: CachedVendor[]) {
  await db.transaction("rw", db.vendedores, async () => {
    await db.vendedores.clear();
    await db.vendedores.bulkAdd(vendors);
  });
  await db.syncMeta.put({ collection: "vendedores", lastSync: Date.now() });
}

/** Guarda el snapshot del dashboard. */
export async function cacheDashboard(data: CachedDashboard) {
  await db.transaction("rw", db.dashboard, async () => {
    await db.dashboard.clear();
    await db.dashboard.add({ ...data, _id: "snapshot" });
  });
  await db.syncMeta.put({ collection: "dashboard", lastSync: Date.now() });
}

// ── Lecturas ────────────────────────────────────────────────

export async function getCachedProducts() {
  return db.productos.toArray();
}

export async function getCachedClients() {
  return db.clientes.toArray();
}

export async function getCachedCategories() {
  return db.categorias.toArray();
}

export async function getCachedVendors() {
  return db.vendedores.toArray();
}

export async function getCachedDashboard() {
  return db.dashboard.get("snapshot");
}

export async function getLastSync(collection: string) {
  const meta = await db.syncMeta.get(collection);
  return meta?.lastSync ?? 0;
}

/** Verdadero si hay al menos datos de productos cacheados (el offline funciona). */
export async function hasOfflineData() {
  const count = await db.productos.count();
  return count > 0;
}

export { db };
