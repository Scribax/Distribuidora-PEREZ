import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // El SW nuevo toma control apenas se instala y recarga la app cuando
      // hay una versión nueva: el usuario no tiene que hacer nada.
      registerType: "autoUpdate",
      // Íconos y assets que deben estar disponibles offline (los referencia
      // el manifest y el <head>). Se suman al precache del app-shell.
      includeAssets: [
        "icon.svg",
        "apple-touch-icon.png",
        "brand-logo-optimized.png",
        "brand-logo.png",
      ],
      manifest: {
        name: "PEREZ MARTIN Distribuidora",
        short_name: "PEREZ MARTIN",
        description: "Sistema de gestión para distribuidora mayorista/minorista",
        start_url: "/",
        display: "standalone",
        background_color: "#111827",
        theme_color: "#e21b23",
        orientation: "any",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precachea todo el app-shell: HTML, JS, CSS e íconos.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        // CLAVE para offline: cualquier navegación (recargar, abrir la PWA
        // instalada) se resuelve con el index.html cacheado en lugar de ir a
        // la red. Sin esto la app no arranca sin conexión.
        navigateFallback: "index.html",
        // Las llamadas a la API NO son navegación y las maneja la capa Dexie
        // (db/sync.ts). Las excluimos del fallback para no interceptarlas.
        navigateFallbackDenylist: [/^\/api/],
        // Al activarse una versión nueva, limpia los precaches viejos: evita
        // que quede sirviendo bundles con hash que ya no existen.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
