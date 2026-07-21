// Service Worker para PEREZ MARTIN Distribuidora
// Estrategia: cachear la shell de la app para que cargue offline.
// Los datos de la API los maneja IndexedDB en el frontend.

const CACHE_NAME = "perez-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/icon.svg",
  "/brand-logo-optimized.png",
  "/apple-touch-icon.png",
  "/pwa-192.png",
  "/pwa-512.png",
  "/maskable-512.png",
  "/manifest.webmanifest",
];

// ── Install: precache de la shell ──────────────────────────

self.addEventListener("install", (event) => {
  console.log("[SW] Instalando — precache de shell");
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Precachea lo que pueda; los assets que fallen se cachean
      // on-demand después.
      await Promise.allSettled(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch(() => {
            /* ignorar 404s — se cachean en runtime */
          })
        )
      );
      // Activar inmediatamente sin esperar que cierren tabs viejas
      self.skipWaiting();
    })()
  );
});

// ── Activate: limpiar caches viejas ────────────────────────

self.addEventListener("activate", (event) => {
  console.log("[SW] Activado");
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      // Tomar control de todas las pestañas
      await self.clients.claim();
    })()
  );
});

// ── Fetch: cache-first para estáticos, network-only para API ─

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // No interceptar llamadas a la API — las maneja el frontend
  // con IndexedDB para el fallback offline.
  if (url.pathname.startsWith("/api/")) {
    return; // deja pasar al navegador → api.ts con IndexedDB
  }

  // Para todo lo demás (HTML, JS, CSS, assets): cache-first
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);
        // Solo cachear respuestas exitosas
        if (response.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        // Si es una navegación y no hay caché, devolver index.html
        if (event.request.mode === "navigate") {
          const fallback = await caches.match("/index.html");
          if (fallback) return fallback;
        }
        throw new Error("Sin conexión y sin caché");
      }
    })()
  );
});
