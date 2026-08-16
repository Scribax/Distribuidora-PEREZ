import React from "react";
import { Megaphone, Shield, Wrench } from "lucide-react";

type Entry = { date: string; text: string; icon: "fix" | "feature" | "security" };

const updates: { month: string; entries: Entry[] }[] = [
  {
    month: "Agosto 2026",
    entries: [
      { date: "15/08", text: "Ahora al crear una boleta, por defecto se usa la lista de precios minorista. Si el cliente es mayorista, lo cambiás con un clic antes de cargar los productos.", icon: "feature" },
      { date: "15/08", text: "Nuevo botón para descargar el catálogo completo de precios en Excel o PDF desde Productos, con la opción de filtrar por categoría.", icon: "feature" },
      { date: "15/08", text: "Se corrigió la organización de los precios: ahora los valores mayoristas y minoristas de cada producto están en la columna correcta.", icon: "fix" },
    ]
  },
  {
    month: "Julio 2026",
    entries: [
      { date: "20/07", text: "Al editar un producto, ahora la pantalla muestra el stock actualizado al instante, sin necesidad de recargar.", icon: "fix" },
      { date: "20/07", text: "Los filtros por fecha en Ventas, Compras y Gastos ahora incluyen correctamente todas las operaciones del día seleccionado.", icon: "fix" },
      { date: "20/07", text: "Los avisos de cobro pendiente ahora siempre muestran el saldo correcto.", icon: "fix" },
    ]
  }
];

const iconMap = {
  fix: { Icon: Wrench, label: "Mejora" },
  feature: { Icon: Megaphone, label: "Novedad" },
  security: { Icon: Shield, label: "Seguridad" },
};

export default function UpdatesView() {
  return (
    <div className="updates-page">
      {updates.map((group) => (
        <section key={group.month} className="panel">
          <h2>{group.month}</h2>
          <ul className="updates-list">
            {group.entries.map((entry, i) => {
              const { Icon, label } = iconMap[entry.icon];
              return (
                <li key={i}>
                  <span className={`updates-badge ${entry.icon}`} title={label}>
                    <Icon size={14} />
                  </span>
                  <time>{entry.date}</time>
                  <span>{entry.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
