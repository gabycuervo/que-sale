import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React, { useState } from "react";
import { CAT_EMOJI } from "../../lib/categories";
import { QUICK_CATS, WHEN_OPTIONS } from "../../lib/planConstants";
import { ChoiceCard, TopBar } from "../ui/AppPrimitives";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import { draftWhenToStartsAtIso, getCurrentCoords } from "../../lib/planUtils";

function EditPlan({ plan, onCancel, onSaved }) {
  const { user } = useAuth();
  // Si el plan tiene una categoría personalizada (creada con "＋ Otro" en Crear
  // plan, ver QuickCreate/CREATE_CATS), no está en QUICK_CATS. Antes, en ese caso,
  // se caía a QUICK_CATS[0] ("Playa") — y si la persona guardaba sin tocar la
  // categoría, el plan quedaba mal reclasificado como "Playa" en vez de conservar
  // su categoría real. Ahora se conserva tal cual (mismo criterio de CAT_EMOJI que
  // ya usan Feed/Detalle/Perfil para categorías sin emoji propio).
  const initialCat = QUICK_CATS.find((c) => c.cat === plan.category) || { cat: plan.category, label: plan.category, emoji: CAT_EMOJI?.[plan.category] || "🏷️" };
  // El bucket guardado (ahora/hoy/finde) no distingue "hoy noche" de "mañana", así que
  // al editar partimos de la opción más cercana; el usuario puede cambiarla si no calza.
  const initialWhenKey = plan.when === "ahora" ? "ahora" : plan.when === "finde" ? "finde" : "noche";
  const initialCount = String(Math.max(1, (plan.capacity || 2) - 1));
  const [cat, setCat] = useState(initialCat.cat);
  const [whenKey, setWhenKey] = useState(initialWhenKey);
  const [mode, setMode] = useState(plan.group ? "grupo" : "solo");
  const [count, setCount] = useState(initialCount);
  const [location, setLocation] = useState(plan.location || "");
  const [joinPolicy, setJoinPolicy] = useState(plan.joinPolicy || "open");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const save = async () => {
    if (!user || saving) return;
    setSaving(true);
    setSaveError(null);

    const catObj = QUICK_CATS.find((c) => c.cat === cat) || initialCat;
    const missingCount = count === "5+" ? 5 : (parseInt(count, 10) || 1);
    const isGroup = mode === "grupo";

    const payload = {
      title: `¿${catObj.label}?`,
      description: isGroup ? `Somos 1 y buscamos ${missingCount} más.` : `Busco ${missingCount} personas, ¿quién se apunta?`,
      category: catObj.cat,
      location_name: location.trim() || plan.location,
      starts_at: draftWhenToStartsAtIso(whenKey),
      capacity: 1 + missingCount,
      is_group: isGroup,
      join_policy: joinPolicy,
    };

    // El .eq("creator_id", user.id) es una defensa extra en el cliente; quien de
    // verdad impide que otro usuario edite este plan es la política RLS de Supabase.
    const { error } = await supabase.from("plans").update(payload).eq("id", plan.id).eq("creator_id", user.id);

    if (error) {
      console.error("[Plans] Error editando plan:", error.message);
      setSaveError(error.message || "No pudimos guardar los cambios. Inténtalo de nuevo.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div style={{ background: CREAM, minHeight: 560 }}>
      <TopBar title="Editar plan" onBack={onCancel} />
      <div style={{ padding: "10px 20px 24px" }}>
        <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: INK, margin: "14px 0 10px", textTransform: "uppercase", letterSpacing: 0.4 }}>Categoría</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {QUICK_CATS.map((c) => (
            <button key={c.label} onClick={() => setCat(c.cat)} style={{ border: cat === c.cat ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`, background: cat === c.cat ? BRAND_BG : "white", borderRadius: 14, padding: "10px 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
              <span style={{ fontSize: 16 }}>{c.emoji}</span><span style={{ fontFamily: FB, fontWeight: 600, fontSize: 12, color: cat === c.cat ? BRAND_DARK : INK }}>{c.label}</span>
            </button>
          ))}
        </div>

        <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: INK, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.4 }}>¿Cuándo?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {WHEN_OPTIONS.map((w) => (
            <button key={w.key} onClick={() => setWhenKey(w.key)} style={{ textAlign: "left", border: whenKey === w.key ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`, background: whenKey === w.key ? BRAND_BG : "white", borderRadius: 12, padding: "11px 14px", fontFamily: FB, fontWeight: 600, fontSize: 13.5, color: whenKey === w.key ? BRAND_DARK : INK, cursor: "pointer" }}>{w.emoji} {w.label}</button>
          ))}
        </div>

        <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: INK, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.4 }}>¿Solo o en grupo?</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[{ k: "solo", label: "Voy solo/a" }, { k: "grupo", label: "Somos un grupo" }].map((o) => (
            <button key={o.k} onClick={() => setMode(o.k)} style={{ flex: 1, border: mode === o.k ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`, background: mode === o.k ? BRAND_BG : "white", borderRadius: 12, padding: "12px 8px", fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: mode === o.k ? BRAND_DARK : INK, cursor: "pointer" }}>{o.label}</button>
          ))}
        </div>

        <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: INK, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.4 }}>¿Cuántas personas buscas?</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["1", "2", "3", "4", "5+"].map((n) => (
            <button key={n} onClick={() => setCount(n)} style={{ flex: 1, border: count === n ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`, background: count === n ? BRAND_BG : "white", borderRadius: 12, padding: "12px 0", fontFamily: FD, fontWeight: 700, fontSize: 15, color: count === n ? BRAND_DARK : INK, cursor: "pointer" }}>{n}</button>
          ))}
        </div>

        <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: INK, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.4 }}>Ubicación</p>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="¿Dónde es el plan?" style={{ width: "100%", fontFamily: FB, fontSize: 13.5, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${LINE}`, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />

        <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: INK, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.4 }}>¿Quién puede unirse?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          <ChoiceCard icon="🌍" iconBg="#E3F9EE" title="Entrada libre" selected={joinPolicy === "open"} onClick={() => setJoinPolicy("open")} />
          <ChoiceCard icon="🙋" iconBg={BRAND_BG} title="Necesito aprobar" selected={joinPolicy === "approval"} onClick={() => setJoinPolicy("approval")} />
        </div>

        {saveError && (
          <div style={{ background: "#FFE9EE", border: "1px solid #FFC2D2", borderRadius: 10, padding: "10px 12px", marginTop: 8 }}>
            <p style={{ fontFamily: FB, fontSize: 12.5, color: "#C21E4C", margin: 0 }}>{saveError}</p>
          </div>
        )}
      </div>
      <div style={{ padding: "0 20px 24px" }}>
        <button onClick={save} disabled={saving} style={{ width: "100%", border: "none", borderRadius: 14, padding: 15, fontFamily: FB, fontWeight: 700, fontSize: 14.5, cursor: saving ? "default" : "pointer", background: saving ? "#B9AEEF" : BRAND, color: "white" }}>{saving ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </div>
  );
}

/* ---------- Join requests sheet (vista del creador) ---------- */
// Bottom sheet donde el creador ve cada solicitud pendiente con el perfil real
// del solicitante (foto, nombre, username, bio, intereses, seguidores/seguidos
// e intereses en común con el propio perfil del creador) y decide Aceptar/Rechazar.

export { EditPlan };
