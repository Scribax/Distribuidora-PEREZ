import { useEffect, useState } from "react";
import { Download } from "lucide-react";

// Evento no estándar de Chromium; lo tipamos localmente.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Detecta si la app ya corre instalada (standalone o iOS home screen).
function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as any).standalone === true;
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // evitamos el mini-infobar automático de Chrome
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Ya instalada, o el navegador no ofrece instalación (p. ej. iOS): no mostramos nada.
  if (installed || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  return (
    <button type="button" className="install-button" onClick={install} title="Instalar la app en tu dispositivo">
      <Download size={18} />Instalar app
    </button>
  );
}
