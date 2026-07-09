import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);

async function clearLegacyPwaCache() {
  if (!("serviceWorker" in navigator)) return;
  if (sessionStorage.getItem("perez_pwa_cleanup_done") === "1") return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const cacheKeys = "caches" in window ? await caches.keys() : [];
  if (!registrations.length && !cacheKeys.length && !navigator.serviceWorker.controller) return;

  sessionStorage.setItem("perez_pwa_cleanup_done", "1");
  await Promise.all(registrations.map((registration) => registration.unregister()));
  await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  window.location.reload();
}

clearLegacyPwaCache().catch(() => undefined);
