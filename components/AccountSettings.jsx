"use client";

import { useState } from "react";
import { ChevronLeft, Mail, KeyRound, UserCog, Bell, ShieldCheck, LogOut, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabaseClient";

/* Mismos tokens de diseño que QueSaleApp.jsx / MyAccountProfile.jsx */
const INK = "#161520";
const CREAM = "#FAF7F1";
const BRAND = "#6C4CFF";
const MUTED = "#8B8798";
const LINE = "#ECE6DA";
const DANGER = "#D64545";
const FD = "'Space Grotesk', 'Segoe UI', sans-serif";
const FB = "'Inter', 'Segoe UI', sans-serif";

const cardStyle = { background: "white", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden", marginBottom: 18 };
const sectionTitleStyle = { fontFamily: FB, fontWeight: 700, fontSize: 11.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 8px 2px" };
const rowStyle = { display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: `1px solid ${LINE}` };
const inputStyle = { width: "100%", fontFamily: FB, fontSize: 13.5, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${LINE}`, outline: "none", boxSizing: "border-box", background: "white", color: INK, marginTop: 8 };

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        border: "none",
        width: 42,
        height: 25,
        borderRadius: 13,
        background: on ? BRAND : LINE,
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        transition: "background .15s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 19 : 2,
          width: 21,
          height: 21,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          transition: "left .15s ease",
        }}
      />
    </button>
  );
}

function Row({ icon, title, subtitle, right }) {
  return (
    <div style={rowStyle}>
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: FB, fontWeight: 600, fontSize: 13.5, color: INK, margin: 0 }}>{title}</p>
        {subtitle && <p style={{ fontFamily: FB, fontSize: 11.5, color: MUTED, margin: "2px 0 0" }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export default function AccountSettings({ onBack }) {
  const { user, profile, signOut, refreshProfile } = useAuth();

  // --- Cambiar correo ---
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailErr, setEmailErr] = useState(null);

  const saveEmail = async () => {
    const value = newEmail.trim();
    if (!value) return;
    setEmailSaving(true);
    setEmailErr(null);
    setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: value });
    if (error) {
      console.error("[Settings] Error cambiando correo:", error.message);
      setEmailErr("No pudimos actualizar tu correo. Intenta de nuevo.");
    } else {
      setEmailMsg("Revisa tu bandeja de entrada (el correo actual y el nuevo) para confirmar el cambio.");
      setNewEmail("");
    }
    setEmailSaving(false);
  };

  // --- Cambiar contraseña ---
  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordErr, setPasswordErr] = useState(null);

  const savePassword = async () => {
    setPasswordErr(null);
    setPasswordMsg(null);
    if (newPassword.length < 6) {
      setPasswordErr("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErr("Las contraseñas no coinciden.");
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      console.error("[Settings] Error cambiando contraseña:", error.message);
      setPasswordErr("No pudimos actualizar tu contraseña. Intenta de nuevo.");
    } else {
      setPasswordMsg("Tu contraseña se actualizó correctamente.");
      setNewPassword("");
      setConfirmPassword("");
      setEditingPassword(false);
    }
    setPasswordSaving(false);
  };

  // --- Notificaciones / privacidad: columnas nuevas en profiles (ver SQL) ---
  const [prefs, setPrefs] = useState({
    notify_messages: profile?.notify_messages ?? true,
    notify_plan_updates: profile?.notify_plan_updates ?? true,
    notify_reminders: profile?.notify_reminders ?? true,
    profile_is_public: profile?.profile_is_public ?? true,
  });
  const [savingKey, setSavingKey] = useState(null);
  const [prefsErr, setPrefsErr] = useState(null);

  const updatePref = async (key, value) => {
    setPrefs((p) => ({ ...p, [key]: value })); // optimista
    setSavingKey(key);
    setPrefsErr(null);
    const { error } = await supabase.from("profiles").update({ [key]: value }).eq("id", user.id);
    if (error) {
      console.error(`[Settings] Error guardando ${key}:`, error.message);
      setPrefs((p) => ({ ...p, [key]: !value })); // revertimos si falló
      setPrefsErr("No pudimos guardar el cambio. Intenta de nuevo.");
    } else {
      await refreshProfile();
    }
    setSavingKey(null);
  };

  // --- Cerrar sesión ---
  const [signingOut, setSigningOut] = useState(false);
  const handleLogout = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  // --- Eliminar cuenta ---
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState(null);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteErr(null);
    const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (error) {
      console.error("[Settings] Error eliminando cuenta:", error.message || error);
      setDeleteErr("No pudimos eliminar tu cuenta. Intenta de nuevo o contáctanos.");
      setDeleting(false);
      return;
    }
    // La cuenta y sus datos ya se eliminaron en el servidor (Edge Function).
    // Cerramos la sesión local: onAuthStateChange limpia user/profile y la
    // app vuelve a mostrar el login automáticamente, igual que en logout.
    await signOut();
  };

  return (
    <div
      style={{
        background: CREAM,
        height: "100dvh",
        minHeight: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 6px" }}>
        <button
          onClick={onBack}
          style={{ border: "none", background: LINE, borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <ChevronLeft size={19} color={INK} />
        </button>
        <p style={{ fontFamily: FD, fontWeight: 600, fontSize: 16, margin: 0, color: INK }}>Ajustes</p>
      </div>

      <div style={{ padding: "14px 16px calc(96px + env(safe-area-inset-bottom, 0px))" }}>
        {/* ---------- Cuenta ---------- */}
        <p style={sectionTitleStyle}>Cuenta</p>
        <div style={cardStyle}>
          <Row
            icon={<UserCog size={17} color={MUTED} />}
            title="Nombre, usuario y foto"
            subtitle="Se edita desde tu perfil"
            right={
              <button onClick={onBack} style={{ border: "none", background: "transparent", color: BRAND, fontFamily: FB, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                Ir a Perfil
              </button>
            }
          />

          <div style={{ borderBottom: `1px solid ${LINE}` }}>
            <Row
              icon={<Mail size={17} color={MUTED} />}
              title="Correo electrónico"
              subtitle={user?.email}
              right={
                <button
                  onClick={() => { setEditingEmail((v) => !v); setEmailErr(null); setEmailMsg(null); }}
                  style={{ border: "none", background: "transparent", color: BRAND, fontFamily: FB, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  {editingEmail ? "Cancelar" : "Cambiar"}
                </button>
              }
            />
            {editingEmail && (
              <div style={{ padding: "0 14px 14px" }}>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nuevo@correo.com"
                  style={inputStyle}
                />
                {emailErr && <p style={{ fontFamily: FB, fontSize: 12, color: DANGER, margin: "8px 0 0" }}>{emailErr}</p>}
                {emailMsg && <p style={{ fontFamily: FB, fontSize: 12, color: "#1E7C3B", margin: "8px 0 0" }}>{emailMsg}</p>}
                <button
                  onClick={saveEmail}
                  disabled={emailSaving || !newEmail.trim()}
                  style={{ marginTop: 10, border: "none", background: BRAND, color: "white", fontFamily: FB, fontWeight: 700, fontSize: 13, padding: "10px 16px", borderRadius: 10, cursor: emailSaving ? "default" : "pointer" }}
                >
                  {emailSaving ? "Guardando…" : "Guardar correo"}
                </button>
              </div>
            )}
          </div>

          <div>
            <Row
              icon={<KeyRound size={17} color={MUTED} />}
              title="Contraseña"
              subtitle="••••••••"
              right={
                <button
                  onClick={() => { setEditingPassword((v) => !v); setPasswordErr(null); setPasswordMsg(null); }}
                  style={{ border: "none", background: "transparent", color: BRAND, fontFamily: FB, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  {editingPassword ? "Cancelar" : "Cambiar"}
                </button>
              }
            />
            {editingPassword && (
              <div style={{ padding: "0 14px 14px" }}>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña (mínimo 6 caracteres)"
                  style={inputStyle}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmar nueva contraseña"
                  style={inputStyle}
                />
                {passwordErr && <p style={{ fontFamily: FB, fontSize: 12, color: DANGER, margin: "8px 0 0" }}>{passwordErr}</p>}
                {passwordMsg && <p style={{ fontFamily: FB, fontSize: 12, color: "#1E7C3B", margin: "8px 0 0" }}>{passwordMsg}</p>}
                <button
                  onClick={savePassword}
                  disabled={passwordSaving}
                  style={{ marginTop: 10, border: "none", background: BRAND, color: "white", fontFamily: FB, fontWeight: 700, fontSize: 13, padding: "10px 16px", borderRadius: 10, cursor: passwordSaving ? "default" : "pointer" }}
                >
                  {passwordSaving ? "Guardando…" : "Guardar contraseña"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Notificaciones ---------- */}
        <p style={sectionTitleStyle}>Notificaciones</p>
        <div style={cardStyle}>
          <Row
            icon={<Bell size={17} color={MUTED} />}
            title="Mensajes de chat"
            subtitle="Cuando te escriben en un plan"
            right={<Toggle on={prefs.notify_messages} disabled={savingKey === "notify_messages"} onChange={(v) => updatePref("notify_messages", v)} />}
          />
          <Row
            icon={<Bell size={17} color={MUTED} />}
            title="Actividad en tus planes"
            subtitle="Alguien se apunta, comenta o edita un plan"
            right={<Toggle on={prefs.notify_plan_updates} disabled={savingKey === "notify_plan_updates"} onChange={(v) => updatePref("notify_plan_updates", v)} />}
          />
          <div style={{ borderBottom: "none" }}>
            <Row
              icon={<Bell size={17} color={MUTED} />}
              title="Recordatorios"
              subtitle="Antes de que empiece un plan"
              right={<Toggle on={prefs.notify_reminders} disabled={savingKey === "notify_reminders"} onChange={(v) => updatePref("notify_reminders", v)} />}
            />
          </div>
        </div>
        {prefsErr && <p style={{ fontFamily: FB, fontSize: 12, color: DANGER, margin: "-10px 2px 14px" }}>{prefsErr}</p>}

        {/* ---------- Privacidad ---------- */}
        <p style={sectionTitleStyle}>Privacidad</p>
        <div style={cardStyle}>
          <div style={{ borderBottom: "none" }}>
            <Row
              icon={<ShieldCheck size={17} color={MUTED} />}
              title="Perfil público"
              subtitle="Otras personas pueden ver tu perfil"
              right={<Toggle on={prefs.profile_is_public} disabled={savingKey === "profile_is_public"} onChange={(v) => updatePref("profile_is_public", v)} />}
            />
          </div>
        </div>
        <p style={{ fontFamily: FB, fontSize: 11.5, color: MUTED, margin: "-10px 2px 18px", lineHeight: 1.4 }}>
          Tu preferencia queda guardada. Aplicarla en todas las pantallas (Feed, planes, chat) es un paso aparte que no se tocó en este bloque para no modificar esa lógica.
        </p>

        {/* ---------- Sesión y cuenta ---------- */}
        <p style={sectionTitleStyle}>Cuenta</p>
        <button
          onClick={handleLogout}
          disabled={signingOut}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
            border: `1.5px solid ${INK}`, background: "transparent", color: INK, fontFamily: FB, fontWeight: 700,
            fontSize: 14, padding: 14, borderRadius: 14, cursor: signingOut ? "default" : "pointer", marginBottom: 14, boxSizing: "border-box",
          }}
        >
          <LogOut size={16} /> {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>

        {!confirmingDelete ? (
          <button
            onClick={() => { setConfirmingDelete(true); setDeleteErr(null); setDeleteText(""); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
              border: "none", background: "transparent", color: DANGER, fontFamily: FB, fontWeight: 700,
              fontSize: 13.5, padding: 12, cursor: "pointer", boxSizing: "border-box",
            }}
          >
            <Trash2 size={15} /> Eliminar cuenta
          </button>
        ) : (
          <div style={{ background: "#FFE9EE", border: "1px solid #FFC2D2", borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={18} color={DANGER} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 14, color: DANGER, margin: 0 }}>Esto no se puede deshacer</p>
            </div>
            <p style={{ fontFamily: FB, fontSize: 12.5, color: INK, margin: "0 0 12px", lineHeight: 1.5 }}>
              Se eliminará tu cuenta, tu perfil, tus planes creados, tu participación en otros planes, tus favoritos, mensajes y notificaciones. Se cerrará tu sesión de inmediato.
            </p>
            <label style={{ fontFamily: FB, fontSize: 11.5, color: MUTED, display: "block", marginBottom: 6 }}>
              Escribe ELIMINAR para confirmar
            </label>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="ELIMINAR"
              style={{ ...inputStyle, marginTop: 0, marginBottom: 12, border: `1.5px solid #FFC2D2` }}
            />
            {deleteErr && <p style={{ fontFamily: FB, fontSize: 12, color: DANGER, margin: "0 0 10px" }}>{deleteErr}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteText.trim().toUpperCase() !== "ELIMINAR"}
                style={{
                  flex: 1, border: "none", background: deleteText.trim().toUpperCase() === "ELIMINAR" ? DANGER : "#F0B6C2",
                  color: "white", fontFamily: FB, fontWeight: 700, fontSize: 13.5, padding: 12, borderRadius: 12,
                  cursor: deleting || deleteText.trim().toUpperCase() !== "ELIMINAR" ? "default" : "pointer",
                }}
              >
                {deleting ? "Eliminando…" : "Eliminar mi cuenta"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                style={{ flex: 1, border: `1.5px solid ${LINE}`, background: "white", color: INK, fontFamily: FB, fontWeight: 700, fontSize: 13.5, padding: 12, borderRadius: 12, cursor: deleting ? "default" : "pointer" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
