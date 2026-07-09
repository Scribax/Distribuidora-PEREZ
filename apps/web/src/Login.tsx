import React, { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { API } from "./api";
import type { Session } from "./types";

export function Login({ onLogin, theme, onToggleTheme }: { onLogin: (session: Session) => void; theme: "light" | "dark"; onToggleTheme: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let parsed: any = { message: `Error ${res.status}` };
        if (text) { try { parsed = JSON.parse(text); } catch { parsed = { message: text.slice(0, 300) }; } }
        throw parsed;
      }
      const session = await res.json();
      localStorage.setItem("perez_session", JSON.stringify(session));
      onLogin(session);
    } catch (err: any) {
      setError(err.message ?? "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }
  return <main className="login-shell">
    <form className="login-panel" onSubmit={submit}>
      <button type="button" className="login-theme-toggle" onClick={onToggleTheme} title={theme === "dark" ? "Modo claro" : "Modo oscuro"}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}{theme === "dark" ? "Claro" : "Oscuro"}</button>
      <div className="login-brand">
        <img src="/brand-logo-optimized.png" alt="Perez Martin Distribuidora" />
        <strong>Perez Martin</strong>
        <h1>Gestión operativa</h1>
      </div>
      <div className="login-form">
        <div className="login-field">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required autoFocus autoComplete="username" />
        </div>
        <div className="login-field">
          <label htmlFor="login-password">Contraseña</label>
          <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
        </div>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="login-submit" disabled={loading}>{loading ? "Ingresando..." : "Ingresar"}</button>
      </div>
      <div className="login-footer">Sistema de gestión · Distribuidora Perez Martin</div>
    </form>
  </main>;
}
