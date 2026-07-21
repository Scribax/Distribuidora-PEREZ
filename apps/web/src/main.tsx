import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

// Registra el service worker que precachea el app-shell. Es lo que permite
// que la app arranque sin internet (y con ella, la cola offline de boletas).
// autoUpdate: la nueva versión se activa sola cuando hay una.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
