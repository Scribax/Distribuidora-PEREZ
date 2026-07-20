import React from "react";
import { Megaphone, Shield, Wrench } from "lucide-react";

type Entry = { date: string; text: string; icon: "fix" | "feature" | "security" };

const updates: { month: string; entries: Entry[] }[] = [
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
