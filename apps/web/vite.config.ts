import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["brand-logo.png", "icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "PEREZ MARTIN Distribuidora",
        short_name: "PEREZ MARTIN",
        description: "Sistema de gestión de la distribuidora Perez Martin",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f7f8fb",
        theme_color: "#e21b23",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml" }
        ]
      },
      workbox: {
        // App shell: cualquier navegación cae en index.html (SPA).
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        runtimeCaching: [
          {
            // Lecturas de la API: red primero, y si no hay conexión servimos la
            // última respuesta cacheada. Workbox solo cachea GET por defecto.
            urlPattern: ({ url, request }) =>
              request.method === "GET" && /\/api\//.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      devOptions: {
        // Permite probar el SW también en `vite dev` si hace falta.
        enabled: false
      }
    })
  ],
  server: {
    port: 5173
  }
});
