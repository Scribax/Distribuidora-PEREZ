import type { Product } from "./types";

export function money(value: number | string) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(value));
}

export function dateInput(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export function qs(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query.toString();
}

export function confirmAction(message: string) {
  return window.confirm(message);
}

export function payload(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form));
}

export function openPdfViewer(blob: Blob, title = "Boleta") {
  const pdfUrl = URL.createObjectURL(blob);
  const safeTitle = title.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia("(max-width: 700px)").matches;
  if (isMobile) {
    const viewer = window.open(pdfUrl, "_blank");
    if (!viewer) window.location.href = pdfUrl;
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 600_000);
    return;
  }
  const viewer = window.open("", "_blank");
  if (!viewer) {
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    return;
  }
  viewer.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    html, body { margin: 0; height: 100%; background: #111827; font-family: Inter, Arial, sans-serif; }
    .toolbar { height: 54px; display: flex; align-items: center; gap: 10px; padding: 0 14px; background: #0f172a; color: white; box-shadow: 0 2px 12px rgba(0,0,0,.25); }
    .toolbar button { border: 0; border-radius: 8px; background: #e21b23; color: white; padding: 9px 12px; font: inherit; font-weight: 700; cursor: pointer; }
    .toolbar span { font-weight: 700; }
    iframe { display: block; width: 100%; height: calc(100% - 54px); border: 0; background: white; }
    @media print {
      .toolbar { display: none; }
      iframe { height: 100%; }
      html, body { background: white; }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button type="button" onclick="history.length > 1 ? history.back() : window.close()">Volver</button><span>${safeTitle}</span></div>
  <iframe src="${pdfUrl}" title="${safeTitle}"></iframe>
</body>
</html>`);
  viewer.document.close();
  viewer.addEventListener("beforeunload", () => URL.revokeObjectURL(pdfUrl));
  window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 600_000);
}


export function itemPrice(product: Product, list: "MAYORISTA" | "MINORISTA") {
  return Number(list === "MAYORISTA" ? product.precioMayorista : product.precioMinorista);
}


export function movementLabel(type: string) {
  const labels: Record<string, string> = { COMPRA: "Compra cargada", REMITO: "Remito emitido", CANCELACION_REMITO: "Remito cancelado", ANULACION_COMPRA: "Compra anulada", AJUSTE_MANUAL: "Ajuste manual", ALTA_PRODUCTO: "Stock inicial", CAMBIO_COSTO: "Cambio de costo" };
  return labels[type] ?? type;
}

export function expenseLabel(type: string) {
  const labels: Record<string, string> = { COMBUSTIBLE: "Combustible", FLETE: "Flete", ALQUILER: "Alquiler", SUELDOS: "Sueldos", SERVICIOS: "Servicios", MANTENIMIENTO: "Mantenimiento", INSUMOS: "Insumos", IMPUESTOS: "Impuestos", OTRO: "Otro" };
  return labels[type] ?? type;
}

export function referenceLabel(reference?: string) {
  if (reference === "Compra") return "Movimiento generado por una compra";
  if (reference === "Remito") return "Movimiento generado por un remito";
  return "Movimiento de stock";
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR");
}

export function formatRemitoRow(r: any) {
  return { ...r, fechaCorta: formatDate(r.fecha), totalFmt: money(r.total), pagadoFmt: money(r.montoPagado ?? 0), itemsCount: r.items?.length ?? 0 };
}

export function remitoPending(row: any) {
  if (row.pagoEstado === "PAGADA") return 0;
  return Math.max(Number(row.total) - Number(row.montoPagado ?? 0), 0);
}

export function formatRemitoItemRow(item: any) {
  return { ...item, precioFmt: money(item.precioUnitario), subtotalFmt: money(item.subtotal) };
}

export function formatPurchaseRow(row: any) {
  return { ...row, fechaCorta: formatDate(row.fecha), totalFmt: money(row.total), itemsCount: row.items?.length ?? 0 };
}

export function formatMovementRow(row: any) {
  return { ...row, createdFmt: new Date(row.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }), tipoFmt: movementLabel(row.tipo) };
}
