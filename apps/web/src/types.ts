export type Role = "ADMINISTRADOR" | "EMPLEADO" | "CONSULTA";
export type User = { id: string; nombre: string; email: string; rol: Role; activo?: boolean };
export type Session = { accessToken: string; refreshToken: string; user: User };
export type Product = { id: string; codigoInterno: string; nombre: string; stockActual: number; stockMinimo: number; precioMayorista: string; precioMinorista: string; costo: string; activo: boolean; categoriaId?: string; categoria?: { id?: string; nombre: string }; movimientos?: any[] };
export type Client = { id: string; nombre: string; empresa?: string; direccion?: string; telefono?: string; email?: string; observaciones?: string; saldoPendiente: string; activo: boolean; remitos?: any[] };
export type Vendor = { id: string; nombre: string; porcentajeComision: string; activo: boolean; ventasTotal?: number; boletasTotal?: number; comisionTotal?: number };
export type Supplier = { id: string; nombre: string; contacto?: string; telefono?: string; email?: string; cuit?: string; direccion?: string; observaciones?: string; activo: boolean };
export type Dashboard = { ventasMes: number; comprasMes: number; costoVendidoMes: number; gastosMes: number; gananciaBrutaMes: number; balanceMes: number; valorStock: number; stockBajo: Product[]; ultimosRemitos: any[]; chart: { mes: string; ventas: number; compras: number; costoVendido: number; gananciaBruta: number; gastos: number; gananciaNeta: number }[] };
export type LineItem = { product: Product; cantidad: number; costoUnitario?: number; actualizarCosto?: boolean };

