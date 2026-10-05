import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React, { useState } from "react";
import { CATEGORIES, CAT_EMOJI } from "../../lib/categories";
import { QUICK_CATS, AVAILABILITY } from "../../lib/planConstants";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import { ChoiceCard } from "../ui/AppPrimitives";

function Onboarding({ onDone }) {
  const [interests, setInterests] = useState([]);
  const [availability, setAvailability] = useState([]);
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <div style={{ background: CREAM, minHeight: 620, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "44px 22px 10px" }}>
        <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 22, color: INK, margin: "0 0 6px" }}>¿Qué te late? 💜</p>
        <p style={{ fontFamily: FB, fontSize: 13.5, color: MUTED, margin: 0 }}>Elige lo que te interesa para armar tu "Para ti". Es opcional y lo puedes cambiar cuando quieras.</p>
      </div>
      <div style={{ padding: "18px 22px 4px", flex: 1 }}>
        <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: INK, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.4 }}>Intereses</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {QUICK_CATS.map((c) => (
            <button key={c.label} onClick={() => toggle(interests, setInterests, c.cat)} style={{ border: interests.includes(c.cat) ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`, background: interests.includes(c.cat) ? BRAND_BG : "white", borderRadius: 16, padding: "8px 13px", fontFamily: FB, fontWeight: 600, fontSize: 12.5, color: interests.includes(c.cat) ? BRAND_DARK : INK, cursor: "pointer" }}>{c.emoji} {c.label}</button>
          ))}
        </div>
        <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: INK, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.4 }}>Disponibilidad (opcional)</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {AVAILABILITY.map((a) => (
            <button key={a} onClick={() => toggle(availability, setAvailability, a)} style={{ border: availability.includes(a) ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`, background: availability.includes(a) ? BRAND_BG : "white", borderRadius: 16, padding: "8px 13px", fontFamily: FB, fontWeight: 600, fontSize: 12.5, color: availability.includes(a) ? BRAND_DARK : INK, cursor: "pointer" }}>{a}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: "10px 22px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => onDone(interests, availability)} style={{ border: "none", background: BRAND, color: "white", fontFamily: FB, fontWeight: 700, fontSize: 14.5, padding: 15, borderRadius: 14, cursor: "pointer" }}>Continuar</button>
        <button onClick={() => onDone([], [])} style={{ border: "none", background: "none", color: MUTED, fontFamily: FB, fontWeight: 600, fontSize: 13, padding: 6, cursor: "pointer" }}>Omitir por ahora</button>
      </div>
    </div>
  );
}

/* ---------- Landing ---------- */

export { Onboarding };
