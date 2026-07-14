import React, { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import type { useApi } from "../api";
import type { Client, LineItem, Product, Supplier, User, Vendor, Dashboard } from "../types";
import { confirmAction, dateInput, expenseLabel, formatDate, formatMovementRow, formatPurchaseRow, formatRemitoItemRow, formatRemitoRow, itemPrice, money, movementLabel, payload, qs, referenceLabel, remitoPending } from "../utils";
import { Metric, Row, Table, SearchBox } from "../components/ui";
import { EntityPicker, ItemList, ProductPicker } from "../components/pickers";

export function UsersView({ api }: { api: ReturnType<typeof useApi> }) {
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
  return <div className="users-page"><section className="panel wide users-list-panel"><Table rows={rows} cols={[["nombre", "Nombre"], ["email", "Email"], ["rol", "Rol"], ["estadoFmt", "Estado"]]} onRowClick={setSelected} /></section><div className="stack users-side">{selected && <section className="panel"><h2>Editar usuario</h2><form className="form" onSubmit={update}><UserFields user={selected} /><input name="password" type="password" placeholder="Nueva contraseña opcional" /><select name="activo" defaultValue={String(selected.activo)}><option value="true">Activo</option><option value="false">Inactivo</option></select><button>Guardar usuario</button></form></section>}<section className="panel"><h2>Nuevo usuario</h2><form className="form" onSubmit={create}><UserFields /><input name="password" type="password" placeholder="Contraseña" required minLength={8} />{error && <p className="error">{error}</p>}<button>Crear usuario</button></form></section></div></div>;
}

function UserFields({ user }: { user?: User }) {
  return <><input name="nombre" defaultValue={user?.nombre} placeholder="Nombre" required /><input name="email" type="email" defaultValue={user?.email} placeholder="Email" required /><select name="rol" defaultValue={user?.rol ?? "EMPLEADO"}><option value="ADMINISTRADOR">Administrador</option><option value="EMPLEADO">Empleado</option><option value="CONSULTA">Consulta</option></select></>;
}
