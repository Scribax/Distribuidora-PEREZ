// Registra el Service Worker y se asegura de que siempre
// esté corriendo la versión más reciente.
if ("serviceWorker" in navigator) {
  let refreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    // La nueva versión está activa — recargar para usarla
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        updateViaCache: "none",
      });
      console.log("[SW] Registrado con scope:", registration.scope);

      // Detectar actualizaciones
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            console.log("[SW] Nueva versión disponible — recargando...");
          }
        });
      });
    } catch (err) {
      console.error("[SW] Error al registrar:", err);
    }
  });
}
