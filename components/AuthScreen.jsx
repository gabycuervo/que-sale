"use client";

import { useState } from "react";
import { useAuth } from "../lib/AuthContext";

/* Mismos tokens de diseño que QueSaleApp.jsx, para mantener consistencia visual */
const INK = "#161520";
const CREAM = "#FAF7F1";
const BRAND = "#6C4CFF";
const BRAND_DARK = "#4B31D1";
const MUTED = "#8B8798";
const LINE = "#ECE6DA";
const FD = "'Space Grotesk', 'Segoe UI', sans-serif";
const FB = "'Inter', 'Segoe UI', sans-serif";

const inputStyle = {
  width: "100%",
  marginTop: 6,
  fontFamily: FB,
  fontSize: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: `1.5px solid ${LINE}`,
  outline: "none",
  boxSizing: "border-box",
  background: "white",
  color: INK,
};

const labelStyle = {
  fontFamily: FB,
  fontWeight: 700,
  fontSize: 11.5,
  color: INK,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

export default function AuthScreen() {
  const { signIn, signUp, authError, clearError } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState(null);

  const switchMode = (m) => {
    setMode(m);
    setInfo(null);
    clearError();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setInfo(null);
    clearError();
    if (!email.trim() || !password) return;

    setSubmitting(true);
    if (mode === "login") {
      await signIn(email.trim(), password);
      // Si hay error, queda disponible en authError y se muestra abajo.
      // Si tiene éxito, onAuthStateChange actualiza el estado global y la
      // app (en QueSaleApp) reacciona mostrando el perfil autenticado.
    } else {
      const { data, error } = await signUp(email.trim(), password);
      if (!error) {
        if (data?.session) {
          // Confirmación de correo desactivada en el proyecto: sesión activa de inmediato.
          setInfo("¡Cuenta creada correctamente!");
        } else {
          setInfo("¡Cuenta creada! Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.");
        }
      }
    }
    setSubmitting(false);
  };

  return (
    <div style={{ background: CREAM, minHeight: 560, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "44px 24px 10px" }}>
        <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 22, color: INK, margin: "0 0 6px" }}>
          {mode === "login" ? "Bienvenido de vuelta 👋" : "Crea tu cuenta 💜"}
        </p>
        <p style={{ fontFamily: FB, fontSize: 13.5, color: MUTED, margin: 0 }}>
          {mode === "login"
            ? "Inicia sesión para ver tu perfil y tus planes."
            : "Regístrate con tu correo para empezar a usar ¿Qué sale?"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ padding: "18px 24px 4px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div>
          <label style={labelStyle}>Correo</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Contraseña</label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            style={inputStyle}
          />
        </div>

        {authError && (
          <div style={{ background: "#FFE9EE", border: "1px solid #FFC2D2", borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ fontFamily: FB, fontSize: 12.5, color: "#C21E4C", margin: 0 }}>{authError}</p>
          </div>
        )}
        {info && (
          <div style={{ background: "#EAF7EE", border: "1px solid #BFE8CC", borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ fontFamily: FB, fontSize: 12.5, color: "#1E7C3B", margin: 0 }}>{info}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: 6,
            border: "none",
            background: submitting ? "#B9AEEF" : `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`,
            color: "white",
            fontFamily: FB,
            fontWeight: 700,
            fontSize: 14.5,
            padding: 15,
            borderRadius: 14,
            cursor: submitting ? "default" : "pointer",
          }}
        >
          {submitting ? "Un momento…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </button>
      </form>

      <div style={{ padding: "10px 24px 28px", textAlign: "center" }}>
        {mode === "login" ? (
          <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, margin: 0 }}>
            ¿No tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => switchMode("signup")}
              style={{ border: "none", background: "none", color: BRAND_DARK, fontFamily: FB, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}
            >
              Regístrate
            </button>
          </p>
        ) : (
          <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, margin: 0 }}>
            ¿Ya tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => switchMode("login")}
              style={{ border: "none", background: "none", color: BRAND_DARK, fontFamily: FB, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}
            >
              Inicia sesión
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
