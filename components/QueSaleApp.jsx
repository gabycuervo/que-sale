"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../lib/theme";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import {
  Home, Search, Plus, Bell, User, ChevronLeft, MapPin, Clock,
  Send, Bookmark, Check, Users, Dice5, Star, X,
  Share2, UserPlus, MessageCircle, Link2, Instagram, Heart, UserCheck
} from "lucide-react";
import { AuthProvider, useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { CAT_COLORS, CATEGORIES, CAT_EMOJI } from "../lib/categories";
import {
  limaDateKeyFromDate,
  limaPartsFromDate,
  limaDateTimeToUtcIso,
  limaNoonUtcForToday,
  draftWhenToStartsAtIso,
  bucketForStartsAt,
  formatPlanWhen,
  joinButtonInfo,
  normalizePlanRow,
  getCurrentCoords,
  checkLocationBlocked,
  planImage,
  planCardBg,
} from "../lib/planUtils";
import AuthScreen from "./AuthScreen";
import MyAccountProfile from "./MyAccountProfile";

// Leaflet necesita "window"/"document", así que este mapa NUNCA puede pre-renderizarse
// en el servidor (Next.js) — de ahí el ssr:false. Reemplaza la vista de grilla de
// Descubrir; esa vista (función Discover, más abajo) se deja intacta sin usar por si
// se quisiera volver atrás.
const DiscoverMap = dynamic(() => import("./DiscoverMap"), {
  ssr: false,
  loading: () => <LoadingBlock text="Cargando mapa…" />,
});
// Mismo motivo que DiscoverMap de arriba (Leaflet necesita "window"): selector de
// ubicación en mapa para "Crear plan" (ver QuickCreate / LocationPicker.jsx).
const LocationPicker = dynamic(() => import("./LocationPicker"), { ssr: false });

/* ---------- Design tokens: brand ¿Qué sale? ---------- */

const STORIES = CATEGORIES.filter((c) => c !== "Todos").map((c) => ({
  key: c, emoji: CAT_EMOJI[c],
}));

const QUICK_CATS = [
  { label: "Playa", emoji: "🏖️", cat: "Playa" }, { label: "Comer", emoji: "🍔", cat: "Comida" },
  { label: "Cine", emoji: "🎬", cat: "Cine" }, { label: "Gaming", emoji: "🎮", cat: "Gaming" },
  { label: "Gym", emoji: "🏋️", cat: "Gym" }, { label: "Deporte", emoji: "⚽", cat: "Deporte" },
  { label: "Música", emoji: "🎵", cat: "Música" }, { label: "Café", emoji: "☕", cat: "Café" },
  { label: "Fotos", emoji: "📸", cat: "Fotos" }, { label: "Roadtrip", emoji: "🚗", cat: "Viajes" },
];
// Solo para el paso "Categoría" de Crear plan (QuickCreate más abajo): mismas
// categorías de siempre (QUICK_CATS, sin tocarlo) + una opción final para
// escribir una categoría propia. No se agrega a QUICK_CATS directamente porque
// ese array también alimenta los chips de "Intereses" en Onboarding, y ahí no
// se pidió (ni tiene sentido) una categoría personalizada.
const CREATE_CATS = [...QUICK_CATS, { label: "＋ Otro", emoji: "➕", cat: "otro" }];
const WHEN_OPTIONS = [
  { key: "ahora", label: "Ahora", emoji: "⚡", bucket: "ahora" }, { key: "noche", label: "Esta noche", emoji: "🌙", bucket: "hoy" },
  { key: "mañana", label: "Mañana", emoji: "📅", bucket: "hoy" }, { key: "finde", label: "Este finde", emoji: "🔥", bucket: "finde" },
];
const AVAILABILITY = ["Ahora", "Tardes", "Noches", "Viernes", "Sábados", "Domingos", "Fines de semana", "Variable"];
// "Destacar mi plan": monetización sin pagos todavía (ver handlePublish / plan_boosts).
// Los precios están fijos acá a propósito; cuando se integre el cobro real, este es
// el único lugar que hay que tocar para que coincidan con lo que se guarda en Supabase.
const BOOST_OPTIONS = [
  { key: "24h", label: "24 horas", hours: 24, price: 3.9 },
  { key: "3d", label: "3 días", hours: 72, price: 6.9 },
  { key: "7d", label: "7 días", hours: 168, price: 9.9 },
];

/* ---------- Small pieces ---------- */
function Avatar({ color, initial, size = 28, ring = true, photo, avatarUrl }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: ring ? "2px solid white" : "none", flexShrink: 0 }} />;
  }
  if (photo) {
    return <img src={img(photo, size * 2, size * 2)} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: ring ? "2px solid white" : "none", flexShrink: 0 }} />;
  }
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 600, fontSize: size * 0.4, fontFamily: FD, border: ring ? "2px solid white" : "none", flexShrink: 0 }}>{initial}</div>;
}
function LiveDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 7, height: 7, marginRight: 5 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: LIVE, animation: "qsPulse 1.4s infinite" }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: LIVE }} />
    </span>
  );
}
function CategoryChips({ active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 16px 14px" }}>
      {CATEGORIES.map((c) => (
        <button key={c} onClick={() => onSelect(c)} style={{ whiteSpace: "nowrap", fontSize: 13, fontFamily: FB, fontWeight: 600, padding: "7px 14px", borderRadius: 20, border: active === c ? "none" : `1px solid ${LINE}`, background: active === c ? INK : "white", color: active === c ? "white" : MUTED, cursor: "pointer" }}>{c}</button>
      ))}
    </div>
  );
}
function StoriesRow({ active, onSelect }) {
  return (
    <div>
      <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 8px 16px" }}>Categorías</p>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 14px" }}>
        {STORIES.map((s) => (
          <button key={s.key} onClick={() => onSelect(s.key)} style={{ border: "none", background: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}>
            <div style={{ width: 54, height: 54, borderRadius: 17, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, background: active === s.key ? CAT_COLORS[s.key] : `${CAT_COLORS[s.key]}1F`, border: active === s.key ? "none" : `1.5px solid ${CAT_COLORS[s.key]}66`, boxShadow: active === s.key ? `0 4px 10px ${CAT_COLORS[s.key]}55` : "none", transition: "transform .15s ease", transform: active === s.key ? "scale(1.04)" : "scale(1)" }}>{s.emoji}</div>
            <span style={{ fontFamily: FB, fontSize: 10.5, fontWeight: 600, color: active === s.key ? INK : MUTED }}>{s.key}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
function TimeTabs({ tab, setTab }) {
  return (
    <div>
      <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 8px 16px" }}>Cuándo</p>
      <div style={{ display: "flex", gap: 8, padding: "0 16px 14px" }}>
        {[{ k: "ahora", label: "🔥 Ahora" }, { k: "hoy", label: "Hoy" }, { k: "finde", label: "Este finde" }].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{ fontFamily: FB, fontSize: 12.5, fontWeight: 700, padding: "7px 13px", borderRadius: 18, cursor: "pointer", background: tab === t.k ? INK : "white", color: tab === t.k ? "white" : MUTED, border: tab === t.k ? "none" : `1px solid ${LINE}` }}>{t.label}</button>
        ))}
      </div>
    </div>
  );
}
function BottomNav({ current, onNav }) {
  const items = [
    { key: "feed", icon: Home, label: "Feed" },
    { key: "discover", icon: Search, label: "Descubrir" },
    { key: "create", icon: Plus, label: "Crear", cta: true },
    { key: "activity", icon: Bell, label: "Actividad" },
    { key: "profile", icon: User, label: "Perfil" },
  ];
  return (
    <div
      style={{
        position: "relative", display: "flex", justifyContent: "space-around", alignItems: "flex-end",
        padding: "8px 6px max(10px, env(safe-area-inset-bottom))", background: "rgba(255,255,255,0.94)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderTop: `1px solid ${LINE}`, boxShadow: "0 -6px 20px rgba(22,21,32,.05)",
      }}
    >
      {items.map(({ key, icon: Icon, label, cta }) => {
        const active = current === key;
        if (cta) {
          return (
            <button key={key} onClick={() => onNav(key)} aria-label={label} style={{ border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transform: "translateY(-14px)" }}>
              <span style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 18px ${BRAND}55`, border: "3px solid white" }}>
                <Icon size={22} color="white" strokeWidth={2.4} />
              </span>
            </button>
          );
        }
        return (
          <button key={key} onClick={() => onNav(key)} aria-label={label} style={{ border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "2px 6px", minWidth: 46 }}>
            <Icon size={21} color={active ? BRAND : "#CFC9DC"} strokeWidth={2.2} />
            <span style={{ fontFamily: FB, fontWeight: active ? 700 : 600, fontSize: 9.5, color: active ? BRAND_DARK : "#B8B2C7" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* Tarjeta de selección "grande y visual" reutilizada en Crear plan / Editar plan:
   icono en badge circular + título + descripción + indicador (check circular o
   contenido a medida vía `trailing`). Puramente de presentación: nunca decide
   la lógica, solo llama al onClick que le pasa el llamador. */
function ChoiceCard({ icon, iconBg, title, subtitle, selected, onClick, trailing }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
        border: selected ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`,
        background: selected ? BRAND_BG : "white", borderRadius: 18, padding: "13px 15px",
        cursor: "pointer", boxSizing: "border-box",
        boxShadow: selected ? `0 6px 16px ${BRAND}26` : "0 2px 8px rgba(22,21,32,.04)",
        transition: "border-color .15s ease, background .15s ease, box-shadow .15s ease",
      }}
    >
      <span style={{ width: 42, height: 42, borderRadius: 14, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 19 }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 14, color: INK, margin: subtitle ? "0 0 2px" : 0 }}>{title}</p>
        {subtitle && <p style={{ fontFamily: FB, fontSize: 12, color: MUTED, margin: 0, lineHeight: 1.35 }}>{subtitle}</p>}
      </span>
      {trailing !== undefined ? trailing : (
        <span style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          border: selected ? "none" : `2px solid ${LINE}`,
          background: selected ? BRAND : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {selected && <Check size={13} color="white" strokeWidth={3} />}
        </span>
      )}
    </button>
  );
}
function TopBar({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 6px" }}>
      <button onClick={onBack} style={{ border: "none", background: LINE, borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={19} color={INK} /></button>
      <p style={{ fontFamily: FD, fontWeight: 600, fontSize: 16, margin: 0, color: INK }}>{title}</p>
    </div>
  );
}
function Toast({ text }) {
  if (!text) return null;
  return <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", background: INK, color: "white", fontFamily: FB, fontWeight: 600, fontSize: 12.5, padding: "9px 16px", borderRadius: 20, zIndex: 40, whiteSpace: "nowrap" }}>{text}</div>;
}

/* ---------- Share sheet ---------- */
function ShareSheet({ plan, mode, onClose, onToast }) {
  // URL real de la app: usa el origen actual (funciona en localhost, en preview
  // de Vercel y en producción), no un dominio fijo inventado.
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "https://quesale.app";
  const link = `${origin}/plan/${plan.id}`;
  const missing = Math.max(0, plan.capacity - plan.joined);
  const text = mode === "invite" ? `Somos ${plan.joined} y necesitamos ${missing} más para "${plan.title}". Únete aquí: ${link}` : `¿Te apuntas a "${plan.title}"? ${plan.hook} ${link}`;
  const openWhatsapp = () => { try { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); } catch (e) {} onToast("Abriendo WhatsApp…"); };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      onToast("¡Enlace copiado! 🔗");
    } catch (e) {
      onToast("No pudimos copiar el enlace.");
    }
  };
  // Web Share API: en móvil abre la hoja de compartir nativa (WhatsApp, Mensajes,
  // Instagram, etc. según lo que tenga el usuario instalado). Si el navegador no
  // la soporta (la mayoría de desktop), caemos a copiar el enlace.
  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: plan.title, text, url: link });
      } catch (e) {
        // El usuario canceló la hoja de compartir o falló: no es un error real, no mostramos toast de error.
      }
    } else {
      copyLink();
    }
  };
  const options = [
    { label: "WhatsApp", icon: MessageCircle, action: openWhatsapp, color: "#25D366" },
    { label: "Instagram", icon: Instagram, action: () => onToast("Copia el enlace y pégalo en tu historia 📸"), color: "#C13584" },
    { label: "Copiar enlace", icon: Link2, action: copyLink, color: MUTED },
    { label: "Compartir con amigos", icon: Share2, action: nativeShare, color: BRAND },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(22,21,32,0.55)", display: "flex", alignItems: "flex-end", zIndex: 30 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", borderRadius: "22px 22px 0 0", padding: "18px 20px 26px" }}>
        <div style={{ width: 36, height: 4, background: LINE, borderRadius: 4, margin: "0 auto 16px" }} />
        <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 15, color: INK, margin: "0 0 4px" }}>{mode === "invite" ? "Invitar amigos" : "Compartir plan"}</p>
        {mode === "invite" && missing > 0 && <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "0 0 14px" }}>Somos {plan.joined} y necesitamos {missing} más</p>}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          {options.map((o) => (
            <button key={o.label} onClick={o.action} style={{ border: "none", background: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", flex: 1 }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: `${o.color}1A`, display: "flex", alignItems: "center", justifyContent: "center" }}><o.icon size={19} color={o.color} /></div>
              <span style={{ fontFamily: FB, fontSize: 10.5, color: INK, textAlign: "center" }}>{o.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Comments sheet ---------- */
function CommentsSheet({ plan, onClose, onToast, onCommentPosted }) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data: rows, error } = await supabase
      .from("plan_comments")
      .select("*")
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[Comments] Error cargando comentarios:", error.message);
      setLoadError("No pudimos cargar los comentarios.");
      setLoading(false);
      return;
    }
    const authorIds = [...new Set((rows || []).map((r) => r.user_id).filter(Boolean))];
    let profilesById = {};
    if (authorIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", authorIds);
      if (profileError) {
        console.error("[Comments] Error cargando perfiles de autores:", profileError.message);
      } else {
        profilesById = Object.fromEntries((profileRows || []).map((p) => [p.id, p]));
      }
    }
    setComments((rows || []).map((row) => {
      const prof = profilesById[row.user_id];
      const name = prof?.display_name || prof?.username || "Usuario";
      return { id: row.id, userId: row.user_id, name, avatarUrl: prof?.avatar_url || null, content: row.content, time: relativeTimeFromNow(row.created_at) };
    }));
    setLoading(false);
  }, [plan.id]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const send = async () => {
    const content = text.trim();
    if (!content || posting) return;
    if (!user) {
      onToast("Inicia sesión para comentar 🙌");
      return;
    }
    setPosting(true);
    const { data: row, error } = await supabase
      .from("plan_comments")
      .insert({ plan_id: plan.id, user_id: user.id, content })
      .select()
      .single();
    if (error) {
      console.error("[Comments] Error publicando comentario:", error.message);
      onToast("No pudimos publicar tu comentario. Intenta de nuevo.");
      setPosting(false);
      return;
    }
    setComments((prev) => [...prev, {
      id: row.id, userId: user.id,
      name: profile?.display_name || profile?.username || "Tú",
      avatarUrl: profile?.avatar_url || null,
      content: row.content, time: "hace un momento",
    }]);
    setText("");
    setPosting(false);
    if (onCommentPosted) onCommentPosted(plan.id);
    if (plan.creator && plan.creator !== user.id) {
      try {
        await supabase.from("notifications").insert({ user_id: plan.creator, actor_id: user.id, message: "comentó tu plan" });
      } catch (e) {
        console.error("[Comments] Error creando notificación (no bloqueante):", e);
      }
    }
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(22,21,32,0.55)", display: "flex", alignItems: "flex-end", zIndex: 30 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", borderRadius: "22px 22px 0 0", padding: "18px 0 0", maxHeight: "78vh", display: "flex", flexDirection: "column" }}>
        <div style={{ width: 36, height: 4, background: LINE, borderRadius: 4, margin: "0 auto 14px" }} />
        <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 15, color: INK, margin: "0 0 10px", padding: "0 20px" }}>
          Comentarios {plan.commentCount != null && plan.commentCount > 0 ? `(${plan.commentCount})` : ""}
        </p>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
          {loading && <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, textAlign: "center", margin: "24px 0" }}>Cargando comentarios…</p>}
          {!loading && loadError && <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, textAlign: "center", margin: "24px 0" }}>{loadError}</p>}
          {!loading && !loadError && comments.length === 0 && (
            <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, textAlign: "center", margin: "24px 0" }}>Sé el primero en comentar 👀</p>
          )}
          {!loading && !loadError && comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 10, padding: "10px 0" }}>
              <Avatar avatarUrl={c.avatarUrl} color={BRAND} initial={(c.name[0] || "?").toUpperCase()} size={30} ring={false} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: FB, fontSize: 13, color: INK, margin: 0 }}>
                  <span style={{ fontWeight: 700 }}>{c.name} </span>{c.content}
                </p>
                <p style={{ fontFamily: FB, fontSize: 11, color: MUTED, margin: "2px 0 0" }}>{c.time}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderTop: `1px solid ${LINE}`, alignItems: "center" }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder={user ? "Escribe un comentario…" : "Inicia sesión para comentar"}
            style={{ flex: 1, fontFamily: FB, fontSize: 13.5, padding: "11px 14px", borderRadius: 20, border: `1.5px solid ${LINE}`, outline: "none", background: CREAM, color: INK }}
          />
          <button
            onClick={send}
            disabled={posting || !text.trim()}
            style={{ border: "none", background: BRAND, width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: posting ? "default" : "pointer", flexShrink: 0 }}
          >
            <Send size={16} color="white" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Plan card ---------- */
function PlanCard({ plan, joined, saved, liked, reqStatus, reason, onOpen, onJoin, onSave, onShare, onLike, onRequestJoin, onCancelRequest, size = "big" }) {
  const total = plan.joined + (joined ? 1 : 0);
  const likeTotal = (plan.likeCountBase || 0) + (liked ? 1 : 0);
  const complete = total >= plan.capacity;
  const info = joinButtonInfo(plan, joined, reqStatus);
  const ctaDisabled = (complete && info.kind !== "leave") || info.kind === "rejected";
  const handleCta = (e) => {
    e.stopPropagation();
    if (ctaDisabled) return;
    if (info.kind === "leave" || info.kind === "join") onJoin(plan.id);
    else if (info.kind === "request") onRequestJoin(plan.id);
    else if (info.kind === "cancel") onCancelRequest(plan.id);
  };
  const h = size === "big" ? 260 : 172;
  const w = size === "live" ? 156 : "auto";
  return (
    <div onClick={() => onOpen(plan.id)} style={{ position: "relative", borderRadius: 20, overflow: "hidden", cursor: "pointer", height: h, width: w, flexShrink: 0, margin: size === "big" ? "0 16px 16px" : 0, background: planCardBg(plan) }}>
      {/* Sin foto propia: emoji de la categoría centrado, en vez de una foto de stock
          aleatoria que podía no corresponder al plan (ver planCardBg/planImage). */}
      {!plan.photoUrl && (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size === "big" ? 54 : 34, pointerEvents: "none" }}>{CAT_EMOJI?.[plan.category] || "📍"}</span>
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,10,20,0.15) 0%, transparent 30%, rgba(15,10,20,0.15) 55%, rgba(15,10,20,0.85) 100%)" }} />

      <div style={{ position: "absolute", top: 10, left: 10, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
        {plan.isFeatured && <div style={{ background: "linear-gradient(135deg,#FFC94D,#FF9A3D)", borderRadius: 20, padding: "3px 9px", display: "flex", alignItems: "center", fontFamily: FB, fontSize: 10.5, fontWeight: 700, color: "white" }}>🚀 Destacado</div>}
        {plan.live && <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 20, padding: "3px 9px", display: "flex", alignItems: "center", fontFamily: FB, fontSize: 10.5, fontWeight: 700, color: LIVE }}><LiveDot /> AHORA</div>}
        {size !== "grid" && (
          <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 20, padding: "3px 9px 3px 3px", display: "flex", alignItems: "center", gap: 5 }}>
            <Avatar avatarUrl={plan.creatorAvatarUrl} color={plan.creatorColor} initial={plan.creatorInitial} size={18} ring={false} />
            <span style={{ fontFamily: FB, fontSize: 10.5, fontWeight: 700, color: INK }}>{plan.creatorName}</span>
          </div>
        )}
      </div>

      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        {!plan.live && <div style={{ background: "rgba(255,255,255,0.55)", borderRadius: 20, padding: "3px 9px", fontSize: 10.5, fontWeight: 700, color: INK, fontFamily: FB }}>{plan.category}</div>}
        <button onClick={(e) => { e.stopPropagation(); onSave(plan.id); }} style={{ border: "none", background: "rgba(255,255,255,0.7)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Bookmark size={13} color={INK} fill={saved ? INK : "none"} /></button>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: size === "big" ? 16 : 10 }}>
        {reason && size === "big" && <p style={{ display: "inline-block", background: "rgba(255,255,255,0.9)", color: BRAND_DARK, fontFamily: FB, fontWeight: 700, fontSize: 10.5, padding: "4px 9px", borderRadius: 10, margin: "0 0 8px" }}>{reason}</p>}
        <p style={{ fontFamily: FD, fontWeight: 600, fontSize: size === "big" ? 18 : 13.5, color: "white", margin: "0 0 3px" }}>{plan.title}</p>
        {size === "big" && <p style={{ fontFamily: FB, fontSize: 12.5, color: "rgba(255,255,255,0.9)", margin: "0 0 3px" }}>{plan.hook}</p>}
        {size === "big" && (
          <p style={{ fontFamily: FB, fontSize: 11.5, color: "rgba(255,255,255,0.8)", margin: "0 0 10px" }}>
            {plan.live ? <>⚡ {plan.startsIn} · {plan.recentJoin}</> : <><MapPin size={11} style={{ verticalAlign: -1 }} /> {plan.location} &middot; {plan.time}</>}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Avatar avatarUrl={plan.creatorAvatarUrl} color={plan.creatorColor} initial={plan.creatorInitial} size={22} />
            <span style={{ fontFamily: FB, fontSize: 11, color: "white", fontWeight: 600 }}>{total}/{plan.capacity}</span>
            {size === "big" && (
              <span style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: FB, fontSize: 10.5, color: "rgba(255,255,255,0.85)" }}>
                  <Heart size={11} fill={liked ? LIVE : "none"} color={liked ? LIVE : "rgba(255,255,255,0.85)"} /> {likeTotal}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: FB, fontSize: 10.5, color: "rgba(255,255,255,0.85)" }}>
                  <MessageCircle size={11} color="rgba(255,255,255,0.85)" /> {plan.commentCount || 0}
                </span>
              </span>
            )}
          </div>
          {size === "big" && (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={(e) => { e.stopPropagation(); onLike(plan.id); }} style={{ border: "none", borderRadius: "50%", width: 32, height: 32, background: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Heart size={14} color={liked ? LIVE : INK} fill={liked ? LIVE : "none"} /></button>
              <button onClick={(e) => { e.stopPropagation(); onShare(plan); }} style={{ border: "none", borderRadius: "50%", width: 32, height: 32, background: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Share2 size={14} color={INK} /></button>
              <button onClick={handleCta} style={{ border: "none", borderRadius: 20, padding: "8px 15px", fontFamily: FB, fontWeight: 700, fontSize: 12, cursor: ctaDisabled ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, background: complete && info.kind !== "leave" ? LIME : info.kind === "leave" ? "white" : info.kind === "cancel" ? "white" : info.kind === "rejected" ? "rgba(255,255,255,0.4)" : BRAND, color: complete && info.kind !== "leave" ? INK : info.kind === "leave" ? BRAND_DARK : info.kind === "cancel" ? MUTED : info.kind === "rejected" ? "rgba(255,255,255,0.8)" : "white" }}>
                {complete && info.kind !== "leave" ? <>🎉 Completo</> : info.kind === "leave" ? <><Check size={13} /> Apuntado</> : info.label}
              </button>
            </div>
          )}
        </div>
        {size === "big" && (
          <div style={{ height: 3, borderRadius: 3, background: "rgba(255,255,255,.25)", marginTop: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, Math.round((total / plan.capacity) * 100))}%`, borderRadius: 3, background: complete ? LIME : "white" }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Onboarding ---------- */
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
function Landing({ nav }) {
  // Antes esta pantalla mostraba una "vitrina" con planes reales de Supabase
  // (los 3 con más gente unida). La Landing es la portada/bienvenida de la app,
  // no una vista más de Feed: no debe mostrar planes reales, así que esa
  // vitrina se quitó por completo. Los planes reales se siguen viendo en Feed,
  // Descubrir/Mapa y Perfil exactamente igual que antes — acá no se tocó nada
  // de Supabase, solo se dejó de renderizar esa lista dentro de Landing.
  return (
    // El centrado vertical ya no se resuelve acá (un height/minHeight en % es
    // frágil quando el padre lo da vía flex-grow + overflow:auto — por eso el
    // intento anterior no centraba de verdad). Ahora .qs-mid (el padre directo,
    // ver clase .qs-landing-center) es el que centra este bloque completo con
    // justify-content, así que este div solo necesita su alto natural de
    // contenido.
    <div style={{ background: CREAM }}>
      <div style={{ padding: "24px 24px 8px" }}>
        {/* Antes acá se repetía casi la misma frase dos veces ("¿Qué sale?" +
            "¿Qué sale hoy?"), y esa segunda línea es exactamente el titular que
            ya usa el Feed — hacía que Landing se sintiera como otra copia del
            Feed en vez de una portada aparte. Ahora el wordmark es solo la marca
            (chico, un logo) y el titular grande dice otra cosa: la propuesta de
            valor, no un eco del Feed. */}
        <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 16, color: BRAND, margin: "0 0 18px", letterSpacing: 0.2 }}>¿QUÉ SALE?</p>
        <h1 style={{ fontFamily: FD, fontWeight: 700, fontSize: 42, lineHeight: 1.1, color: INK, margin: "0 0 16px" }}>Encuentra tu<br />próximo plan 👀</h1>
        <p style={{ fontFamily: FB, fontSize: 16.5, color: MUTED, margin: "0 0 28px", lineHeight: 1.5 }}>Descubre qué está pasando cerca de ti ahora mismo y con quién hacerlo.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <button onClick={() => nav("feed")} style={{ border: "none", background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`, color: "white", fontFamily: FB, fontWeight: 700, fontSize: 17, padding: 18, borderRadius: 16, cursor: "pointer" }}>Ver qué sale</button>
          <button onClick={() => nav("create")} style={{ border: `1.5px solid ${INK}`, background: "transparent", color: INK, fontFamily: FB, fontWeight: 700, fontSize: 17, padding: 18, borderRadius: 16, cursor: "pointer" }}>Crear mi primer plan</button>
        </div>
      </div>
    </div>
  );
}

function Surprise({ plan, onClose, onView }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(22,21,32,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20, padding: 24 }}>
      <div style={{ background: "white", borderRadius: 22, padding: 22, width: "100%", boxShadow: "0 12px 30px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 16, color: BRAND_DARK, margin: 0 }}>✨ Hoy podrías ir por ramen</p>
          <button onClick={onClose} style={{ border: "none", background: LINE, borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
        </div>
        <p style={{ fontFamily: FB, fontSize: 14, color: INK, margin: "0 0 4px" }}>{plan.joined} personas ya están interesadas.</p>
        <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, margin: "0 0 16px" }}><MapPin size={12} style={{ verticalAlign: -1 }} /> {plan.location}</p>
        <button onClick={onView} style={{ width: "100%", border: "none", background: BRAND, color: "white", fontFamily: FB, fontWeight: 700, fontSize: 14, padding: 13, borderRadius: 14, cursor: "pointer" }}>Ver plan</button>
      </div>
    </div>
  );
}

function reasonFor(plan, interests) {
  if (interests.includes(plan.category)) return `Porque te gusta ${plan.category} y estás cerca 👀`;
  return null;
}

function Feed({ plans, joinedIds, savedIds, likedIds, requestStatusByPlan, onJoin, onSave, onLike, onRequestJoin, onCancelRequest, onOpen, onShareOpen, tab, setTab, story, setStory, nav, interests }) {
  const { user, profile } = useAuth();
  const [surprisePlan, setSurprisePlan] = useState(null);
  const byStory = story ? plans.filter((p) => p.category === story) : plans;
  let shown = byStory.filter((p) => p.when === tab);
  if (interests.length) shown = [...shown].sort((a, b) => (interests.includes(b.category) ? 1 : 0) - (interests.includes(a.category) ? 1 : 0));
  const liveNow = plans.filter((p) => p.live);
  const pickSurprise = () => { if (plans.length) setSurprisePlan(plans[Math.floor(Math.random() * plans.length)]); };

  return (
    <div style={{ background: CREAM, minHeight: 500, position: "relative" }}>
      {surprisePlan && <Surprise plan={surprisePlan} onClose={() => setSurprisePlan(null)} onView={() => { const id = surprisePlan.id; setSurprisePlan(null); onOpen(id); }} />}
      {/* Header "hero": antes era una barra blanca plana + un botón aparte.
          Ahora es una sola tarjeta con el degradado de marca (mismo BRAND/BRAND_DARK/
          LIVE que ya usa el resto de la app), con blobs decorativos puramente CSS
          (sin imágenes nuevas) para darle profundidad. El copy de la segunda línea
          usa liveNow.length, que ya se calculaba antes — dato real, no inventado. */}
      <div style={{ margin: "16px 16px 18px", borderRadius: 24, padding: "22px 20px 20px", position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 60%, ${LIVE} 145%)` }}>
        <div style={{ position: "absolute", width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.12)", top: -55, right: -35, pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.1)", bottom: -30, left: -20, pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
          <div>
            <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 22, margin: 0, color: "white" }}>¿Qué sale hoy? 👀</p>
            <p style={{ fontFamily: FB, fontSize: 13, color: "rgba(255,255,255,.88)", margin: "4px 0 0", display: "flex", alignItems: "center", gap: 5 }}>
              {liveNow.length > 0 ? <><LiveDot />{liveNow.length} {liveNow.length === 1 ? "plan está pasando" : "planes están pasando"} ahora</> : "Planes cerca de ti"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button onClick={() => nav("saved")} style={{ border: "none", background: "rgba(255,255,255,.22)", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Bookmark size={15} color="white" fill={savedIds.size ? "white" : "none"} /></button>
            <div onClick={() => nav("profile")} style={{ cursor: "pointer" }}>
              {user ? (
                <Avatar avatarUrl={profile?.avatar_url} color="rgba(255,255,255,.28)" initial={(profile?.display_name || profile?.username || user.email || "?")[0].toUpperCase()} size={34} />
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.2)", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <User size={16} color="white" />
                </div>
              )}
            </div>
          </div>
        </div>

        <button onClick={pickSurprise} style={{ marginTop: 16, width: "100%", border: "none", borderRadius: 14, padding: "12px 16px", cursor: "pointer", background: "rgba(255,255,255,.95)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: FB, fontWeight: 700, fontSize: 13.5, color: BRAND_DARK, position: "relative" }}>
          <Dice5 size={16} /> ¿No sabes qué hacer? Sorpréndeme
        </button>
      </div>

      <div style={{ paddingTop: 16 }}><StoriesRow active={story} onSelect={(k) => setStory(story === k ? null : k)} /></div>
      <TimeTabs tab={tab} setTab={setTab} />

      {tab !== "ahora" && liveNow.length > 0 && (
        <div style={{ marginBottom: 10, background: `${LIVE}0D`, padding: "12px 0 6px" }}>
          <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 14.5, color: INK, margin: "4px 16px 10px", display: "flex", alignItems: "center", gap: 6 }}><LiveDot />Algo está saliendo ahora 🔥</p>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 16px" }}>
            {liveNow.map((p) => <PlanCard key={p.id} plan={p} joined={joinedIds.has(p.id)} saved={savedIds.has(p.id)} liked={likedIds.has(p.id)} reqStatus={requestStatusByPlan[p.id]} onOpen={onOpen} onJoin={onJoin} onSave={onSave} onShare={onShareOpen} onLike={onLike} onRequestJoin={onRequestJoin} onCancelRequest={onCancelRequest} size="live" />)}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 16px 12px" }}>
        <span style={{ width: 5, height: 18, borderRadius: 3, background: `linear-gradient(180deg, ${BRAND}, ${LIVE})`, display: "inline-block" }} />
        <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 14.5, color: BRAND_DARK, margin: 0 }}>Para ti 💜</p>
      </div>
      <div>
        {shown.map((p) => <PlanCard key={p.id} plan={p} joined={joinedIds.has(p.id)} saved={savedIds.has(p.id)} liked={likedIds.has(p.id)} reqStatus={requestStatusByPlan[p.id]} reason={reasonFor(p, interests)} onOpen={onOpen} onJoin={onJoin} onSave={onSave} onShare={onShareOpen} onLike={onLike} onRequestJoin={onRequestJoin} onCancelRequest={onCancelRequest} />)}
        {shown.length === 0 && <p style={{ textAlign: "center", color: MUTED, fontFamily: FB, fontSize: 13, padding: "40px 24px" }}>No tienes plan. Todavía. 👀<br />Prueba otra categoría o pulsa Sorpréndeme.</p>}
      </div>
    </div>
  );
}

function Discover({ plans, joinedIds, savedIds, onJoin, onSave, onOpen, onShareOpen, filter, setFilter }) {
  const shown = filter === "Todos" ? plans : plans.filter((p) => p.category === filter);
  return (
    <div style={{ background: CREAM, minHeight: 500 }}>
      <div style={{ padding: "20px 16px 4px" }}><p style={{ fontFamily: FD, fontWeight: 700, fontSize: 20, margin: 0, color: INK }}>Descubrir</p></div>
      <CategoryChips active={filter} onSelect={setFilter} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "6px 16px 16px" }}>
        {shown.map((p) => <PlanCard key={p.id} plan={p} joined={joinedIds.has(p.id)} saved={savedIds.has(p.id)} onOpen={onOpen} onJoin={onJoin} onSave={onSave} onShare={onShareOpen} size="grid" />)}
      </div>
      {shown.length === 0 && <p style={{ textAlign: "center", color: MUTED, fontFamily: FB, fontSize: 13, padding: "40px 24px" }}>Todavía no hay planes en esta categoría.<br />Prueba con "Todos" o crea el primero. 👀</p>}
    </div>
  );
}

function Saved({ plans, savedIds, joinedIds, likedIds, requestStatusByPlan, onJoin, onSave, onLike, onRequestJoin, onCancelRequest, onOpen, onShareOpen, onBack }) {
  const shown = plans.filter((p) => savedIds.has(p.id));
  return (
    <div style={{ background: CREAM, minHeight: 500 }}>
      <TopBar title="Guardados" onBack={onBack} />
      <div style={{ padding: "6px 0 16px" }}>
        {shown.map((p) => <PlanCard key={p.id} plan={p} joined={joinedIds.has(p.id)} saved liked={likedIds.has(p.id)} reqStatus={requestStatusByPlan[p.id]} onOpen={onOpen} onJoin={onJoin} onSave={onSave} onShare={onShareOpen} onLike={onLike} onRequestJoin={onRequestJoin} onCancelRequest={onCancelRequest} />)}
        {shown.length === 0 && <p style={{ textAlign: "center", color: MUTED, fontFamily: FB, fontSize: 13, padding: "40px 24px" }}>Aún no guardaste ningún plan. Toca el 🔖 en una tarjeta para guardarla.</p>}
      </div>
    </div>
  );
}

/* ---------- Quick create ----------
   Wizard móvil de 3 pasos (antes eran 5 pantallas que avanzaban solas al tocar
   cualquier opción, sin botón "Siguiente" y sin poder ver/corregir lo elegido
   antes de avanzar). Ahora:
   Paso 1 = Categoría + ¿Cuándo? + ¿Solo o grupo? + ¿Cuántas personas? (todas
            las preguntas del plan en sí, reveladas en cascada en una sola
            pantalla, con "Siguiente" al fondo).
   Paso 2 = Quién puede unirse (SOLO las dos opciones reales: entrada libre /
            necesito aprobar), como tarjetas grandes.
   Paso 3 = Destacar + resumen visual final + Publicar.
   Ninguna query ni campo de Supabase cambia: sigue siendo el mismo `draft`
   que ya esperaba handlePublish. */
function QuickCreate({ onPublish, onCancel, publishing, publishError }) {
  const TOTAL_STEPS = 3;
  const [step, setStep] = useState(1);
  // Antes acá había un valor fijo ("Miraflores, Lima") que se guardaba tal cual en
  // location_name si la persona no lo cambiaba a mano — sin relación real con dónde
  // se hace el plan ni con las coordenadas GPS reales que sí se piden más abajo
  // (ver handlePublish/getCurrentCoords en AppShell). Ahora arranca vacío: la
  // persona escribe el lugar real, y el paso 3 no deja publicar sin ese texto.
  const [draft, setDraft] = useState({ cat: null, when: null, mode: null, count: null, location: "", boost: null, joinPolicy: "open", coords: null, coordsSource: null });
  // (Antes acá había un estado "editLoc" que alternaba entre mostrar un <p> con
  // "Cambiar" o el <input> de ubicación, según "!editLoc && draft.location.trim()".
  // Como draft.location nunca se precarga (ver comentario de arriba: ya no hay
  // ningún valor por defecto tipo "Miraflores, Lima"), esa condición se volvía
  // true apenas la persona escribía UNA letra — React desmontaba el <input> y
  // montaba el <p> en su lugar, así que el navegador cerraba el teclado en cada
  // tecla. No era un problema de foco: era un cambio de tipo de nodo en cada
  // render. Se quita ese estado y esa rama muerta por completo; el campo de
  // ubicación ahora es siempre el mismo <input>, nunca se remonta.)
  // (Antes acá había un estado "locationRequested" que solo cambiaba el texto/
  // habilitado del botón de publicar. Ya no hace falta: ahora ese botón depende
  // directamente de si ya existe draft.coords, ver más abajo.)
  // Texto libre cuando la persona elige "＋ Otro" en el paso 1 (ver CREATE_CATS).
  // Se guarda aparte del draft.cat mientras escribe, y solo se vuelca a la
  // categoría real (resolvedCat, más abajo) al avanzar/publicar — así el campo
  // puede quedar vacío mientras la persona todavía está escribiendo sin que
  // eso rompa la vista previa del paso 3.
  const [otherCategoryText, setOtherCategoryText] = useState("");
  // Hora real elegida por la persona para "¿Cuándo?" (formato "HH:MM" de
  // <input type="time">), separada de WHEN_OPTIONS: antes cada opción ("Esta
  // noche", "Mañana", "Este finde") traía una hora fija hardcodeada en
  // draftWhenToStartsAtIso (20:00 / 18:00 / 12:00) que se guardaba tal cual sin
  // que la persona la hubiera elegido nunca — por eso el plan siempre terminaba
  // a las 6:00pm si elegía "Mañana". Arranca vacío (no se precarga con esas
  // horas fijas ni con ninguna otra, para no mostrar una hora ficticia como si
  // ya estuviera elegida) y solo se muestra/pide cuando "Ahora" no es la
  // opción (para "Ahora" se sigue usando la hora real del momento, sin picker).
  const [timeStr, setTimeStr] = useState("");
  // Estado del selector de ubicación en mapa ("📍 Elegir ubicación", ver más abajo)
  // y de la solicitud de GPS para "📍 Cerca de mí". Ninguno de los dos reemplaza a
  // getCurrentCoords (definida arriba en este archivo): "Cerca de mí" la llama
  // directamente acá para fijar el pin de una vez, en vez de esperar a publicar.
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locatingNear, setLocatingNear] = useState(false);
  const [nearLocationError, setNearLocationError] = useState(null);
  // Indicador visual de scroll (solo paso 1): el scroll real ocurre en el
  // contenedor ancestro .qs-mid (ver AppShell), no acá adentro — por eso se
  // detecta ahí mismo en vez de crear un scroll propio nuevo. Se recalcula al
  // hacer scroll, al cambiar de tamaño y cada vez que el paso 1 revela más
  // campos (la lista de dependencias de abajo), y solo se muestra si de
  // verdad queda contenido por debajo sin ver.
  const rootRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  useEffect(() => {
    if (step !== 1) { setShowScrollHint(false); return; }
    const scrollEl = rootRef.current?.closest(".qs-mid");
    if (!scrollEl) return;
    const check = () => {
      const hasMore = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight > 12;
      setShowScrollHint(hasMore);
    };
    check();
    scrollEl.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(scrollEl);
    return () => {
      scrollEl.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      ro?.disconnect();
    };
  }, [step, draft.cat, draft.when, draft.mode, draft.count, timeStr]);
  const back = () => (step === 1 ? onCancel() : setStep((s) => s - 1));
  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  // Con "＋ Otro" seleccionado, el paso 1 no se da por completo hasta que haya
  // texto real de categoría (ver CREATE_CATS/otherCategoryText arriba). Igual
  // con la hora: si "¿Cuándo?" no es "Ahora", hace falta que la persona haya
  // elegido una hora real en el picker (ver timeStr arriba) — así nunca se
  // avanza con una hora fija que nadie eligió.
  const needsTime = draft.when && draft.when.key !== "ahora";
  const step1Complete = !!(
    draft.cat && (draft.cat.cat !== "otro" || otherCategoryText.trim()) && draft.when && (!needsTime || timeStr) && draft.mode && draft.count
  );
  // Categoría final a mostrar/guardar: si se eligió "＋ Otro", usa el texto escrito
  // (mismo valor para label y cat, ya que una categoría personalizada no tiene un
  // nombre "técnico" distinto del que la persona escribió); si no, el draft.cat de
  // siempre. Se calcula acá (no se pisa draft.cat en cada tecla) para que el campo
  // de texto pueda pasar por vacío mientras se escribe sin romper nada.
  const resolvedCat = draft.cat?.cat === "otro"
    ? { label: otherCategoryText.trim() || "Otro", cat: otherCategoryText.trim() || "Otro", emoji: "🏷️" }
    : draft.cat;

  // "📍 Cerca de mí": pide el GPS ya mismo (reutiliza getCurrentCoords, la misma
  // función que ya usaba handlePublish en AppShell) y deja el pin listo antes de
  // publicar, en vez de recién pedirlo al final sin que la persona lo haya elegido.
  const handleUseNear = async () => {
    setNearLocationError(null);
    setLocatingNear(true);
    const { coords, errorCode } = await getCurrentCoords();
    setLocatingNear(false);
    if (!coords) {
      setNearLocationError(
        errorCode === 1
          ? "El permiso de ubicación está bloqueado para este sitio. Permítelo desde los ajustes del navegador e inténtalo de nuevo."
          : "No pudimos obtener tu ubicación. Revisa tu GPS/conexión e inténtalo de nuevo."
      );
      return;
    }
    setDraft((d) => ({ ...d, coords, coordsSource: "near" }));
  };

  const sectionTitle = { fontFamily: FD, fontWeight: 700, fontSize: 19, color: INK, margin: "22px 0 14px" };
  const sectionTitleFirst = { ...sectionTitle, margin: "6px 0 14px" };

  const selectableChip = (selected) => ({
    border: selected ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`,
    background: selected ? BRAND_BG : "white",
    borderRadius: 20, padding: "18px 10px", display: "flex", flexDirection: "column",
    alignItems: "center", gap: 8, cursor: "pointer",
    boxShadow: selected ? `0 4px 14px ${BRAND}33` : "0 2px 10px rgba(22,21,32,.05)",
    transition: "all .15s ease",
  });

  return (
    <div ref={rootRef} style={{ background: CREAM, minHeight: 560, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 0" }}>
        <button onClick={back} style={{ border: "none", background: LINE, borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <ChevronLeft size={19} color={INK} />
        </button>
        <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 16, margin: 0, color: INK }}>Crear plan</p>
        <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 11.5, color: MUTED, margin: "0 0 0 auto" }}>Paso {step} de {TOTAL_STEPS}</p>
      </div>
      {/* Barra de progreso: 3 segmentos anchos y claros, uno por paso real del wizard. */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px 0" }}>
        {[1, 2, 3].map((s) => (
          <span key={s} style={{ flex: 1, height: 5, borderRadius: 4, background: s <= step ? BRAND : LINE, transition: "background .2s ease" }} />
        ))}
      </div>

      <div style={{ padding: "6px 20px 24px", flex: 1 }}>
        {step === 1 && (<>
          <p style={sectionTitleFirst}>Categoría</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {CREATE_CATS.map((c) => {
              const color = CAT_COLORS[c.cat] || BRAND;
              // El tile "＋ Otro" se resalta por su valor sentinel (cat === "otro"),
              // no por label: una vez que la persona escribe su categoría más abajo,
              // draft.cat.label deja de ser "＋ Otro" pero el tile debe seguir marcado.
              const selected = c.cat === "otro" ? draft.cat?.cat === "otro" : draft.cat?.label === c.label;
              return (
                <button key={c.label} onClick={() => setDraft({ ...draft, cat: c })} style={selectableChip(selected)}>
                  <span style={{ width: 46, height: 46, borderRadius: 14, background: `${color}1F`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{c.emoji}</span>
                  <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: INK }}>{c.label}</span>
                </button>
              );
            })}
          </div>

          {draft.cat?.cat === "otro" && (
            <input
              autoFocus
              value={otherCategoryText}
              onChange={(e) => setOtherCategoryText(e.target.value)}
              placeholder="Escribe tu categoría (ej. Concierto, Feria...)"
              // fontSize en 16px (no 13px): en Safari/Chrome móvil, un input con
              // font-size menor a 16px hace que el navegador haga zoom automático
              // de toda la pantalla al enfocarlo. 16px es el mínimo que evita ese
              // zoom sin tocar el layout (mismo padding/alto de siempre).
              style={{ width: "100%", marginTop: 10, fontFamily: FB, fontSize: 16, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${LINE}`, outline: "none", boxSizing: "border-box" }}
            />
          )}

          {draft.cat && (
            <>
              <p style={sectionTitle}>¿Cuándo?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {WHEN_OPTIONS.map((w) => (
                  <ChoiceCard key={w.key} icon={w.emoji} iconBg={`${BRAND}14`} title={w.label} selected={draft.when?.key === w.key} onClick={() => setDraft({ ...draft, when: w })} />
                ))}
              </div>

              {/* Hora real del plan: solo se pide cuando "¿Cuándo?" no es "Ahora"
                  (ahí sí tiene sentido elegir un horario concreto dentro de ese
                  día). Arranca vacío a propósito — nunca se precarga con 20:00/
                  18:00/12:00 como si la persona ya los hubiera elegido — y hasta
                  que no se completa, step1Complete no deja avanzar (ver arriba). */}
              {needsTime && (
                <>
                  <p style={sectionTitle}>¿A qué hora?</p>
                  <input
                    type="time"
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    style={{ width: "100%", fontFamily: FB, fontSize: 16, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${LINE}`, outline: "none", boxSizing: "border-box" }}
                  />
                </>
              )}
            </>
          )}

          {draft.cat && draft.when && (
            <>
              <p style={sectionTitle}>¿Vas solo o en grupo?</p>
              <div style={{ display: "flex", gap: 10 }}>
                {[{ k: "solo", label: "Voy solo/a", emoji: "🙋" }, { k: "grupo", label: "Somos un grupo", emoji: "👥" }].map((o) => {
                  const selected = draft.mode === o.k;
                  return (
                    <button key={o.k} onClick={() => setDraft({ ...draft, mode: o.k })} style={{ ...selectableChip(selected), flex: 1, padding: "24px 10px" }}>
                      <span style={{ width: 52, height: 52, borderRadius: "50%", background: `${BRAND}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{o.emoji}</span>
                      <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: INK }}>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {draft.cat && draft.when && draft.mode && (
            <>
              <p style={sectionTitle}>¿Cuántas personas buscamos?</p>
              <div style={{ display: "flex", gap: 8 }}>
                {["1", "2", "3", "4", "5+"].map((n) => {
                  const selected = draft.count === n;
                  return (
                    <button key={n} onClick={() => setDraft({ ...draft, count: n })} style={{ flex: 1, border: selected ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`, background: selected ? BRAND_BG : "white", borderRadius: 14, padding: "16px 0", fontFamily: FD, fontWeight: 700, fontSize: 16, color: selected ? BRAND_DARK : INK, cursor: "pointer" }}>{n}</button>
                  );
                })}
              </div>
            </>
          )}
        </>)}

        {step === 2 && (<>
          <p style={sectionTitleFirst}>¿Quién puede unirse?</p>
          <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "-8px 0 18px" }}>Podés cambiarlo después desde "Editar plan".</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={() => setDraft({ ...draft, joinPolicy: "open" })} style={{ textAlign: "left", border: draft.joinPolicy === "open" ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`, background: draft.joinPolicy === "open" ? BRAND_BG : "white", borderRadius: 22, padding: 20, cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start", boxShadow: draft.joinPolicy === "open" ? `0 4px 14px ${BRAND}33` : "0 2px 10px rgba(22,21,32,.05)" }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, background: "#E3F9EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🌍</span>
              <div>
                <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 15.5, color: INK, margin: "0 0 4px" }}>Entrada libre</p>
                <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: 0, lineHeight: 1.4 }}>Cualquiera puede unirse directamente.</p>
              </div>
            </button>
            <button onClick={() => setDraft({ ...draft, joinPolicy: "approval" })} style={{ textAlign: "left", border: draft.joinPolicy === "approval" ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`, background: draft.joinPolicy === "approval" ? BRAND_BG : "white", borderRadius: 22, padding: 20, cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start", boxShadow: draft.joinPolicy === "approval" ? `0 4px 14px ${BRAND}33` : "0 2px 10px rgba(22,21,32,.05)" }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, background: BRAND_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🙋</span>
              <div>
                <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 15.5, color: INK, margin: "0 0 4px" }}>Necesito aprobar</p>
                <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: 0, lineHeight: 1.4 }}>Las personas deben enviar una solicitud y vos decides si aceptar o rechazar.</p>
              </div>
            </button>
          </div>
        </>)}

        {step === 3 && draft.cat && (<>
          <p style={sectionTitleFirst}>🎉 ¡Listo para publicar!</p>
          <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "-8px 0 14px" }}>Así se verá tu plan apenas lo publiques.</p>

          {/* Vista previa tipo tarjeta de Feed/Descubrir: banner con color+emoji de la
              categoría (todavía no hay foto real hasta publicar) en vez de un bloque de
              texto plano — para que se sienta como una tarjeta de app, no un resumen de formulario. */}
          <div style={{ borderRadius: 22, overflow: "hidden", boxShadow: "0 6px 18px rgba(22,21,32,.08)" }}>
            <div style={{ position: "relative", height: 120, background: `${CAT_COLORS[resolvedCat.cat] || BRAND}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 52 }}>{resolvedCat.emoji}</span>
              <span style={{ position: "absolute", top: 10, left: 10, fontFamily: FB, fontWeight: 700, fontSize: 10.5, color: "white", background: CAT_COLORS[resolvedCat.cat] || BRAND, padding: "4px 10px", borderRadius: 20 }}>{resolvedCat.label}</span>
            </div>
            <div style={{ background: "white", padding: "14px 16px" }}>
              <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 16, margin: "0 0 8px", color: INK }}>¿{resolvedCat.label}?</p>
              <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}><Clock size={12} /> {draft.when.label}</p>
              <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}><Users size={12} /> {draft.mode === "grupo" ? "Somos un grupo" : "Voy solo/a"} · buscamos {draft.count}</p>
              <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>{draft.joinPolicy === "approval" ? "🙋 Necesito aprobar" : "🌍 Entrada libre"}</p>
              {/* "(detectada)" era falso: ese texto nunca salía del GPS ni de ningún
                  geocoding, era el valor fijo "Miraflores, Lima" (ver useState de
                  arriba) salvo que la persona lo edite a mano. Ahora, sin texto
                  cargado, se muestra directamente el campo para escribirlo — nunca
                  se afirma que algo fue "detectado" sin serlo. */}
              {/* Sin autoFocus: al entrar al paso 3 este input aparece de entrada
                  (draft.location empieza vacío) y el autoFocus anterior abría el
                  teclado y seleccionaba el campo solo, disparando el zoom del
                  navegador apenas se pisaba el paso. Ahora la persona lo toca
                  cuando quiere escribir. fontSize en 16px (no 13px) por la misma
                  razón que el input de "＋ Otro": evita el zoom automático de
                  Safari/Chrome móvil también cuando sí se enfoca a mano.
                  Siempre es el mismo <input> (nunca se reemplaza por un <p>,
                  ver comentario del estado "editLoc" removido más arriba): así
                  no se remonta ni pierde foco/teclado en cada letra. */}
              <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="¿Dónde es el plan?" style={{ width: "100%", marginTop: 6, fontFamily: FB, fontSize: 16, padding: "8px 10px", borderRadius: 10, border: `1.5px solid ${LINE}`, outline: "none", boxSizing: "border-box" }} />

              {/* Coordenadas reales del plan: antes salían SIEMPRE del GPS del
                  dispositivo al momento de publicar (ver handlePublish en AppShell),
                  sin relación con el texto de arriba — si la persona escribía un
                  lugar distinto de donde estaba parada, el pin quedaba mal puesto.
                  Ahora la persona elige de dónde salen esas coordenadas: su GPS
                  actual, o un punto que marca a mano en el mapa (para cuando el
                  plan es en otro lugar). handlePublish usa draft.coords si ya
                  viene resuelto acá, y solo cae de nuevo al GPS al publicar como
                  respaldo si por algo no se llegó a elegir ninguno. */}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={handleUseNear}
                  disabled={locatingNear}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    border: draft.coordsSource === "near" ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`,
                    background: draft.coordsSource === "near" ? BRAND_BG : "white",
                    borderRadius: 12, padding: "10px 8px", fontFamily: FB, fontWeight: 700, fontSize: 12,
                    color: draft.coordsSource === "near" ? BRAND_DARK : INK, cursor: locatingNear ? "default" : "pointer",
                  }}
                >
                  📍 {locatingNear ? "Ubicando…" : "Cerca de mí"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLocationPicker(true)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    border: draft.coordsSource === "choose" ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`,
                    background: draft.coordsSource === "choose" ? BRAND_BG : "white",
                    borderRadius: 12, padding: "10px 8px", fontFamily: FB, fontWeight: 700, fontSize: 12,
                    color: draft.coordsSource === "choose" ? BRAND_DARK : INK, cursor: "pointer",
                  }}
                >
                  📍 Elegir ubicación
                </button>
              </div>
              {nearLocationError && <p style={{ fontFamily: FB, fontSize: 11, color: "#C21E4C", margin: "6px 0 0" }}>{nearLocationError}</p>}
              {draft.coords && !nearLocationError && (
                <p style={{ fontFamily: FB, fontSize: 11, color: MUTED, margin: "6px 0 0" }}>
                  {draft.coordsSource === "near" ? "Usaremos tu ubicación GPS actual para el pin del mapa." : "Usaremos el punto que marcaste en el mapa."}
                </p>
              )}
            </div>
          </div>

          <div style={{ marginTop: 26 }}>
            <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 16, color: INK, margin: "0 0 3px" }}>🚀 Destacar mi plan</p>
            <p style={{ fontFamily: FB, fontSize: 12, color: MUTED, margin: "0 0 12px" }}>Opcional. Tu plan aparece marcado como destacado por el tiempo que elijas.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ChoiceCard
                icon="✨" iconBg="#F2F0FA"
                title="No destacar plan" subtitle="Gratis"
                selected={draft.boost == null}
                onClick={() => setDraft({ ...draft, boost: null })}
              />
              {BOOST_OPTIONS.map((b) => (
                <ChoiceCard
                  key={b.key}
                  icon="🚀" iconBg="#FFF1DC"
                  title={b.label}
                  selected={draft.boost?.key === b.key}
                  onClick={() => setDraft({ ...draft, boost: b })}
                  trailing={
                    <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 13, color: draft.boost?.key === b.key ? BRAND_DARK : MUTED, flexShrink: 0 }}>
                      S/ {b.price.toFixed(2)}
                    </span>
                  }
                />
              ))}
            </div>
          </div>

          {!draft.coords && (
            <div style={{ marginTop: 22, background: "white", border: `1.5px solid ${LINE}`, borderRadius: 20, padding: 18, boxShadow: "0 4px 14px rgba(22,21,32,.06)", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 42, height: 42, borderRadius: 14, background: BRAND_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📍</span>
              <div>
                <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 15, color: INK, margin: "0 0 4px" }}>¿Qué sale? necesita tu ubicación</p>
                <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: 0, lineHeight: 1.45 }}>Elige "Cerca de mí" o "Elegir ubicación" arriba para colocar tu plan en el mapa y mostrarlo a personas cercanas.</p>
              </div>
            </div>
          )}

          {publishError && (
            <div style={{ background: "#FFE9EE", border: "1px solid #FFC2D2", borderRadius: 10, padding: "10px 12px", marginTop: 10 }}>
              <p style={{ fontFamily: FB, fontSize: 12.5, color: "#C21E4C", margin: 0 }}>{publishError}</p>
            </div>
          )}
        </>)}
      </div>

      {/* Indicador discreto de "hay más contenido abajo" para el paso 1. Sticky
          dentro del flujo (con margen negativo para no sumar espacio extra),
          así queda pegado al fondo del área visible mientras se pueda seguir
          bajando y desaparece solo al llegar al final o si todo entra en
          pantalla. No agrega scroll propio ni tapa el botón "Siguiente". */}
      {/* DIAGNÓSTICO TEMPORAL: render comentado para descartar si este
          elemento (sticky + margen negativo dentro de un flex-column) está
          causando el comportamiento de scroll "trabado" reportado en móvil.
          El useEffect que calcula showScrollHint sigue activo, sin tocar. */}
      {/* {step === 1 && showScrollHint && (
        <div style={{ position: "sticky", bottom: 0, height: 34, marginTop: -34, background: `linear-gradient(to bottom, rgba(250,247,242,0) 0%, ${CREAM} 80%)`, pointerEvents: "none", zIndex: 2 }} />
      )} */}

      <div style={{ padding: "0 20px 24px" }}>
        {step === 1 && (
          <button onClick={next} disabled={!step1Complete} style={{ width: "100%", border: "none", borderRadius: 14, padding: 15, fontFamily: FB, fontWeight: 700, fontSize: 14.5, cursor: step1Complete ? "pointer" : "default", background: step1Complete ? BRAND : "#D8D2E8", color: "white" }}>Siguiente</button>
        )}
        {step === 2 && (
          <button onClick={next} style={{ width: "100%", border: "none", borderRadius: 14, padding: 15, fontFamily: FB, fontWeight: 700, fontSize: 14.5, cursor: "pointer", background: BRAND, color: "white" }}>Siguiente</button>
        )}
        {step === 3 && (() => {
          // La ubicación ya no trae un valor por defecto (ver useState de arriba), y
          // ahora tampoco alcanza con el texto: hace falta además haber elegido de
          // dónde salen las coordenadas reales del pin ("Cerca de mí" o "Elegir
          // ubicación" más arriba), para no volver a depender en silencio del GPS
          // del dispositivo al momento de publicar.
          const hasLocation = !!draft.location.trim();
          const hasCoords = !!draft.coords;
          const disabledReason = !hasLocation || !hasCoords;
          const label = publishing
            ? "Publicando…"
            : !hasLocation
              ? "Escribe dónde es el plan"
              : !hasCoords
                ? "Elige tu ubicación arriba"
                : "🚀 Publicar plan";
          return (
            <button
              onClick={() => onPublish({ ...draft, cat: resolvedCat, time: timeStr })}
              disabled={publishing || disabledReason}
              style={{ width: "100%", border: "none", borderRadius: 14, padding: 15, fontFamily: FB, fontWeight: 700, fontSize: 14.5, cursor: (publishing || disabledReason) ? "default" : "pointer", background: (publishing || disabledReason) ? "#B9AEEF" : BRAND, color: "white" }}
            >
              {label}
            </button>
          );
        })()}
      </div>

      {showLocationPicker && (
        <LocationPicker
          initialCoords={draft.coordsSource === "choose" ? draft.coords : null}
          onCancel={() => setShowLocationPicker(false)}
          onConfirm={(point) => {
            setDraft((d) => ({ ...d, coords: point, coordsSource: "choose" }));
            setShowLocationPicker(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Editar plan (solo el creador llega aquí, ver PlanDetail/AppShell) ---------- */
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
function JoinRequestsSheet({ plan, onClose, onResolved, onChat }) {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [matchInfo, setMatchInfo] = useState(null); // { name, avatarUrl } — para el "¡Hicieron match!"

  const myInterests = new Set((profile?.interests || []).map((i) => String(i).toLowerCase()));

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data: rows, error } = await supabase
      .from("plan_join_requests")
      .select("id, user_id, created_at")
      .eq("plan_id", plan.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[JoinRequests] Error cargando solicitudes:", error.message);
      setLoadError("No pudimos cargar las solicitudes.");
      setLoading(false);
      return;
    }
    const userIds = [...new Set((rows || []).map((r) => r.user_id))];
    let profilesById = {};
    let followerCountById = {};
    let followingCountById = {};
    if (userIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, bio, interests")
        .in("id", userIds);
      if (profileError) console.error("[JoinRequests] Error cargando perfiles:", profileError.message);
      profilesById = Object.fromEntries((profileRows || []).map((p) => [p.id, p]));

      // Seguidores/seguidos reales de public.follows (mismo patrón que CreatorProfile).
      const { data: followerRows, error: followerError } = await supabase
        .from("follows").select("following_id").in("following_id", userIds);
      if (followerError) console.error("[JoinRequests] Error contando seguidores:", followerError.message);
      for (const f of followerRows || []) followerCountById[f.following_id] = (followerCountById[f.following_id] || 0) + 1;

      const { data: followingRows, error: followingError } = await supabase
        .from("follows").select("follower_id").in("follower_id", userIds);
      if (followingError) console.error("[JoinRequests] Error contando seguidos:", followingError.message);
      for (const f of followingRows || []) followingCountById[f.follower_id] = (followingCountById[f.follower_id] || 0) + 1;
    }

    setRequests((rows || []).map((r) => {
      const p = profilesById[r.user_id];
      const interests = p?.interests || [];
      const shared = interests.filter((i) => myInterests.has(String(i).toLowerCase()));
      return {
        id: r.id,
        userId: r.user_id,
        name: p?.display_name || p?.username || "Usuario",
        username: p?.username || null,
        avatarUrl: p?.avatar_url || null,
        bio: p?.bio || "",
        interests,
        sharedInterests: shared,
        followerCount: followerCountById[r.user_id] || 0,
        followingCount: followingCountById[r.user_id] || 0,
      };
    }));
    setLoading(false);
  }, [plan.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const resolve = async (req, accept) => {
    if (busyId) return;
    setBusyId(req.id);
    const { error } = await supabase
      .from("plan_join_requests")
      .update({ status: accept ? "accepted" : "rejected", responded_at: new Date().toISOString() })
      .eq("id", req.id);
    if (error) {
      console.error("[JoinRequests] Error actualizando solicitud:", error.message);
      setBusyId(null);
      return;
    }
    if (accept) {
      const { error: participantError } = await supabase.from("plan_participants").insert({ plan_id: plan.id, user_id: req.userId });
      if (participantError && participantError.code !== "23505") {
        console.error("[JoinRequests] Error añadiendo participante:", participantError.message);
      }
      try {
        await supabase.from("notifications").insert({ user_id: req.userId, actor_id: user.id, message: `Tu solicitud para "${plan.title}" fue aceptada 🎉` });
      } catch (e) {
        console.error("[JoinRequests] Error creando notificación (no bloqueante):", e);
      }
      setMatchInfo({ name: req.name, avatarUrl: req.avatarUrl });
    } else {
      try {
        await supabase.from("notifications").insert({ user_id: req.userId, actor_id: user.id, message: `Tu solicitud para "${plan.title}" no fue aceptada.` });
      } catch (e) {
        console.error("[JoinRequests] Error creando notificación (no bloqueante):", e);
      }
    }
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    setBusyId(null);
    onResolved?.();
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(22,21,32,0.55)", display: "flex", alignItems: "flex-end", zIndex: 40 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: CREAM, width: "100%", borderRadius: "24px 24px 0 0", padding: "18px 0 0", maxHeight: "82vh", display: "flex", flexDirection: "column" }}>
        <div style={{ width: 36, height: 4, background: LINE, borderRadius: 4, margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 12px" }}>
          <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 16, color: INK, margin: 0 }}>Solicitudes pendientes</p>
          <button onClick={onClose} style={{ border: "none", background: LINE, borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={15} color={INK} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
          {loading && <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, textAlign: "center", margin: "24px 0" }}>Cargando solicitudes…</p>}
          {!loading && loadError && <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, textAlign: "center", margin: "24px 0" }}>{loadError}</p>}
          {!loading && !loadError && requests.length === 0 && (
            <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, textAlign: "center", margin: "24px 0" }}>No quedan solicitudes pendientes 🙌</p>
          )}
          {!loading && requests.map((r) => (
            <div key={r.id} style={{ background: "white", border: `1px solid ${LINE}`, borderRadius: 18, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <Avatar avatarUrl={r.avatarUrl} color={BRAND} initial={(r.name[0] || "?").toUpperCase()} size={46} ring={false} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 14.5, color: INK, margin: 0 }}>{r.name}</p>
                  {r.username && <p style={{ fontFamily: FB, fontSize: 12, color: MUTED, margin: "1px 0 0" }}>@{r.username}</p>}
                  <p style={{ fontFamily: FB, fontSize: 11.5, color: MUTED, margin: "3px 0 0" }}>{r.followerCount} seguidores · {r.followingCount} seguidos</p>
                </div>
              </div>
              {r.bio && <p style={{ fontFamily: FB, fontSize: 12.5, color: INK, margin: "0 0 8px" }}>"{r.bio}"</p>}
              {r.sharedInterests.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: .4, margin: "0 0 6px" }}>Intereses en común</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {r.sharedInterests.map((it, i) => <span key={i} style={{ fontFamily: FB, fontWeight: 700, fontSize: 11, color: BRAND_DARK, background: BRAND_BG, padding: "4px 9px", borderRadius: 10 }}>{it}</span>)}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => resolve(r, false)} disabled={busyId === r.id} style={{ flex: 1, border: "1.5px solid #FFC2D2", background: "#FFE9EE", color: "#C21E4C", fontFamily: FB, fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, cursor: busyId === r.id ? "default" : "pointer" }}>Rechazar</button>
                <button onClick={() => resolve(r, true)} disabled={busyId === r.id} style={{ flex: 1, border: "none", background: BRAND, color: "white", fontFamily: FB, fontWeight: 700, fontSize: 13, padding: 12, borderRadius: 12, cursor: busyId === r.id ? "default" : "pointer" }}>{busyId === r.id ? "…" : "Aceptar"}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Momento de "match": reemplaza el alert genérico anterior por una pantalla
          celebratoria conectada al flujo REAL de aceptación (matchInfo solo se
          setea arriba, dentro de resolve(), justo después de aceptar de verdad
          una solicitud en Supabase — nunca se inventa). Fotos de perfil reales
          de ambas personas + una tarjeta del plan real, con accesos directos a
          chat o a seguir viendo el plan. */}
      {matchInfo && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(22,21,32,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={() => setMatchInfo(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 28, padding: "30px 22px 22px", textAlign: "center", width: "100%", maxWidth: 320, boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}>
            <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 13, color: BRAND_DARK, letterSpacing: 1, textTransform: "uppercase", margin: "0 0 18px" }}>Hicieron match para este plan</p>

            <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", height: 78, marginBottom: 18 }}>
              <div style={{ position: "absolute", left: "50%", transform: "translateX(-64px)" }}>
                <Avatar avatarUrl={profile?.avatar_url} color={BRAND} initial={(profile?.display_name || "?")[0]?.toUpperCase()} size={72} />
              </div>
              <div style={{ position: "absolute", left: "50%", transform: "translateX(-8px)" }}>
                <Avatar avatarUrl={matchInfo.avatarUrl} color={LIVE} initial={(matchInfo.name[0] || "?").toUpperCase()} size={72} />
              </div>
              {/* Manos "agarrándose": una insignia circular superpuesta justo entre
                  las dos fotos de perfil, con el emoji de manos dándose la mano
                  como elemento visual central del momento de conexión. */}
              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 38, height: 38, borderRadius: "50%", background: "white", border: `3px solid ${CREAM}`, boxShadow: "0 4px 10px rgba(22,21,32,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, zIndex: 2 }}>
                🤝
              </div>
            </div>

            <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 19, color: INK, margin: "0 0 6px" }}>🎉 ¡Match!</p>
            <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "0 0 20px", lineHeight: 1.45 }}>Tú y {matchInfo.name} ya pueden coordinar los detalles de este plan.</p>

            {/* Tarjeta del plan real: mismos datos que ya se muestran en el resto
                de la app (foto/categoría/título/ubicación/fecha-hora), nunca inventados. */}
            <div style={{ borderRadius: 18, overflow: "hidden", textAlign: "left", boxShadow: "0 4px 14px rgba(22,21,32,.1)", marginBottom: 18 }}>
              <div style={{ position: "relative", height: 84, background: plan.photoUrl ? `#eee url(${plan.photoUrl}) center/cover no-repeat` : `${CAT_COLORS[plan.category] || BRAND}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {!plan.photoUrl && <span style={{ fontSize: 34 }}>{CAT_EMOJI?.[plan.category] || "📍"}</span>}
              </div>
              <div style={{ background: "white", padding: "10px 12px" }}>
                <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 13.5, color: INK, margin: "0 0 4px" }}>{plan.title}</p>
                <p style={{ fontFamily: FB, fontSize: 11.5, color: MUTED, margin: "0 0 2px", display: "flex", alignItems: "center", gap: 5 }}><MapPin size={11} /> {plan.location}</p>
                <p style={{ fontFamily: FB, fontSize: 11.5, color: MUTED, margin: 0, display: "flex", alignItems: "center", gap: 5 }}><Clock size={11} /> {plan.time}</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { const id = plan.id; setMatchInfo(null); onClose?.(); onChat?.(id); }}
                style={{ flex: 1, border: "none", background: BRAND, color: "white", fontFamily: FB, fontWeight: 700, fontSize: 13, padding: 13, borderRadius: 14, cursor: "pointer" }}
              >
                Ir al chat
              </button>
              <button
                onClick={() => { setMatchInfo(null); onClose?.(); }}
                style={{ flex: 1, border: `1.5px solid ${LINE}`, background: "white", color: INK, fontFamily: FB, fontWeight: 700, fontSize: 13, padding: 13, borderRadius: 14, cursor: "pointer" }}
              >
                Ver plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanDetail({ plan, joined, saved, liked, reqStatus, onJoin, onSave, onLike, onRequestJoin, onCancelRequest, onBack, onChat, onProfile, onShareOpen, onInviteOpen, onCommentsOpen, onOpenPerson, onEdit, onDelete }) {
  const { user } = useAuth();
  const [justJoined, setJustJoined] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [requestsSheetOpen, setRequestsSheetOpen] = useState(false);
  const total = plan.joined + (joined ? 1 : 0);
  const likeTotal = (plan.likeCountBase || 0) + (liked ? 1 : 0);
  const complete = total >= plan.capacity;
  const missing = Math.max(0, plan.capacity - total);
  const pct = Math.min(100, Math.round((total / plan.capacity) * 100));
  // Solo el creador ve los botones de editar/cancelar. La comprobación real que
  // impide que otro usuario edite o borre el plan es la política RLS de Supabase;
  // esto es únicamente para no mostrar los botones a quien no es el dueño.
  const isOwner = !!user && plan.creator === user.id;
  const info = joinButtonInfo(plan, joined, reqStatus);

  const handleCancelPlan = async () => {
    if (deleting) return;
    const confirmed = window.confirm("¿Seguro que quieres cancelar y eliminar este plan? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    setDeleting(true);
    const success = await onDelete(plan.id);
    // Si tuvo éxito, AppShell ya navegó de vuelta al feed y este componente se
    // desmontó: no tocamos más su estado para evitar un warning de React por
    // actualizar un componente ya desmontado. Si falló, seguimos aquí y sí
    // hay que reactivar el botón.
    if (!success) setDeleting(false);
  };

  // Participantes reales (foto/nombre) desde public.plan_participants + public.profiles.
  // No hay una relación de Supabase configurada entre esas tablas (igual que plans/profiles
  // en loadPlans), así que se piden por separado y se combinan aquí en el cliente.
  const loadParticipants = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from("plan_participants")
      .select("user_id")
      .eq("plan_id", plan.id);
    if (error) {
      console.error("[Participants] Error cargando participantes del plan:", error.message);
      return;
    }
    const userIds = [...new Set((rows || []).map((r) => r.user_id).filter(Boolean))];
    if (userIds.length === 0) {
      setParticipants([]);
      return;
    }
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", userIds);
    if (profileError) {
      console.error("[Participants] Error cargando perfiles de participantes:", profileError.message);
      return;
    }
    const profilesById = Object.fromEntries((profileRows || []).map((p) => [p.id, p]));
    setParticipants(userIds.map((id) => {
      const prof = profilesById[id];
      const name = prof?.display_name || prof?.username || "Usuario";
      return { id, name, avatarUrl: prof?.avatar_url || null, initial: (name[0] || "?").toUpperCase() };
    }));
  }, [plan.id]);

  // Se vuelve a cargar también cuando cambia `joined` (apuntarse/salir), para reflejar
  // la fila real que ya inserta/borra handleJoin sin tocar esa función.
  useEffect(() => { loadParticipants(); }, [loadParticipants, joined]);

  // Solo si el plan requiere aprobación y soy el dueño: cuántas solicitudes
  // pendientes hay, para mostrar el botón "Solicitudes pendientes (N)".
  const loadPendingCount = useCallback(async () => {
    if (!isOwner || plan.joinPolicy !== "approval") {
      setPendingRequestCount(0);
      return;
    }
    const { count, error } = await supabase
      .from("plan_join_requests")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", plan.id)
      .eq("status", "pending");
    if (error) console.error("[JoinRequests] Error contando solicitudes pendientes:", error.message);
    setPendingRequestCount(count ?? 0);
  }, [isOwner, plan.id, plan.joinPolicy]);

  useEffect(() => { loadPendingCount(); }, [loadPendingCount]);

  return (
    <div style={{ background: CREAM, minHeight: 560 }}>
      {/* Imagen superior: si el plan tiene photo_url propio, se muestra tal cual (prioridad
          1). Si no, en vez del placeholder anterior (una foto de stock de loremflickr
          compartida entre TODOS los planes de la misma categoría, que podía verse como si
          perteneciera a otro plan), se usa el mismo tratamiento visual de categoría que ya
          existe en la app (ver ShareSheet, match de plan: color de fondo + emoji de
          CAT_COLORS/CAT_EMOJI de lib/categories) — no pretende ser una foto real del plan. */}
      <div style={{ position: "relative", height: 220, background: plan.photoUrl ? `#eee url(${plan.photoUrl}) center/cover no-repeat` : `${CAT_COLORS[plan.category] || BRAND}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!plan.photoUrl && <span style={{ fontSize: 54 }}>{CAT_EMOJI?.[plan.category] || "📍"}</span>}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.15), transparent 40%)" }} />
        <div style={{ position: "absolute", top: 14, left: 14 }}><button onClick={onBack} style={{ border: "none", background: "rgba(255,255,255,0.7)", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={19} color={INK} /></button></div>
        <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 8 }}>
          <button onClick={() => onLike(plan.id)} style={{ border: "none", background: "rgba(255,255,255,0.7)", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Heart size={16} color={liked ? LIVE : INK} fill={liked ? LIVE : "none"} /></button>
          <button onClick={() => onSave(plan.id)} style={{ border: "none", background: "rgba(255,255,255,0.7)", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Bookmark size={16} color={INK} fill={saved ? INK : "none"} /></button>
          <button onClick={() => onShareOpen(plan)} style={{ border: "none", background: "rgba(255,255,255,0.7)", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Share2 size={16} color={INK} /></button>
        </div>
        {plan.live && <div style={{ position: "absolute", bottom: 14, right: 14, background: "rgba(255,255,255,0.9)", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", fontFamily: FB, fontSize: 11, fontWeight: 700, color: LIVE }}><LiveDot />AHORA</div>}
      </div>
      <div style={{ padding: "18px 20px 100px" }}>
        <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 22, color: INK, margin: "0 0 8px" }}>{plan.title}</p>
        {plan.group && <span style={{ display: "inline-block", background: BRAND_BG, color: BRAND_DARK, fontFamily: FB, fontWeight: 700, fontSize: 11.5, padding: "4px 10px", borderRadius: 12, marginBottom: 10 }}>Plan de grupo</span>}
        <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
          {plan.live ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: FB, fontSize: 13, color: LIVE, fontWeight: 700 }}>⚡ {plan.startsIn}</span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: FB, fontSize: 13, color: MUTED }}><Clock size={13} /> {plan.time}</span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: FB, fontSize: 13, color: MUTED }}><MapPin size={13} /> {plan.location}</span>
        </div>
        {plan.live && <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "-6px 0 12px" }}>{plan.recentJoin}</p>}
        {plan.hook && <p style={{ fontFamily: FB, fontSize: 14.5, color: INK, lineHeight: 1.55, margin: "0 0 18px" }}>"{plan.hook}"</p>}

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: FB, fontSize: 13, color: INK, fontWeight: 600 }}>
            <Heart size={15} fill={liked ? LIVE : "none"} color={liked ? LIVE : MUTED} /> {likeTotal} {likeTotal === 1 ? "like" : "likes"}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: FB, fontSize: 13, color: INK, fontWeight: 600 }}>
            <MessageCircle size={15} color={MUTED} /> {plan.commentCount || 0} {plan.commentCount === 1 ? "comentario" : "comentarios"}
          </span>
        </div>

        <div onClick={onProfile} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, cursor: "pointer" }}>
          <Avatar avatarUrl={plan.creatorAvatarUrl} color={plan.creatorColor} initial={plan.creatorInitial} size={36} />
          <div><p style={{ fontFamily: FB, fontWeight: 700, fontSize: 13.5, margin: 0, color: INK }}>{plan.creatorName}</p><p style={{ fontFamily: FB, fontSize: 12, margin: 0, color: MUTED }}>Organiza este plan</p></div>
        </div>

        <div style={{ background: "white", border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 13, margin: 0, color: INK }}>Participantes</p>
            <p style={{ fontFamily: FB, fontSize: 12.5, margin: 0, color: MUTED }}>{total}/{plan.capacity}</p>
          </div>
          <div style={{ height: 6, background: LINE, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}><div style={{ height: "100%", width: `${pct}%`, background: complete ? LIME : BRAND, transition: "width .4s" }} /></div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {participants.length > 0 ? (
              <>
                {participants.slice(0, 4).map((p, i) => (
                  <div key={p.id} onClick={() => onOpenPerson && onOpenPerson(p.id)} style={{ marginLeft: i === 0 ? 0 : -10, cursor: onOpenPerson ? "pointer" : "default" }}>
                    <Avatar avatarUrl={p.avatarUrl} color={BRAND} initial={p.initial} size={28} />
                  </div>
                ))}
                {Math.max(0, total - Math.min(participants.length, 4)) > 0 && <div style={{ marginLeft: -10, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.15)", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: INK, fontWeight: 600 }}>+{Math.max(0, total - Math.min(participants.length, 4))}</div>}
              </>
            ) : (
              <>
                <Avatar avatarUrl={plan.creatorAvatarUrl} color={plan.creatorColor} initial={plan.creatorInitial} size={28} />
                {Math.max(0, total - 1) > 0 && <div style={{ marginLeft: -10, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.15)", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: INK, fontWeight: 600 }}>+{Math.max(0, total - 1)}</div>}
              </>
            )}
          </div>
          {complete && <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 13, color: BRAND_DARK, marginTop: 10 }}>🎉 ¡Plan completo!</p>}
        </div>

        {isOwner && (
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <button onClick={() => onEdit(plan.id)} style={{ flex: 1, border: `1.5px solid ${LINE}`, background: "white", color: INK, fontFamily: FB, fontWeight: 700, fontSize: 13.5, padding: 13, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>✏️ Editar plan</button>
            <button onClick={handleCancelPlan} disabled={deleting} style={{ flex: 1, border: "1.5px solid #FFC2D2", background: "#FFE9EE", color: "#C21E4C", fontFamily: FB, fontWeight: 700, fontSize: 13.5, padding: 13, borderRadius: 14, cursor: deleting ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{deleting ? "Cancelando…" : "🗑️ Cancelar plan"}</button>
          </div>
        )}
        {isOwner && plan.joinPolicy === "approval" && pendingRequestCount > 0 && (
          <button onClick={() => setRequestsSheetOpen(true)} style={{ width: "100%", border: "none", background: BRAND, color: "white", fontFamily: FB, fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 14, cursor: "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            💜 Solicitudes pendientes ({pendingRequestCount})
          </button>
        )}
        {!complete && <button onClick={() => onInviteOpen(plan)} style={{ width: "100%", border: `1.5px solid ${BRAND}`, background: BRAND_BG, color: BRAND_DARK, fontFamily: FB, fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 14, cursor: "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><UserPlus size={16} /> Invitar amigos {missing > 0 && `· faltan ${missing}`}</button>}
        <button onClick={() => onCommentsOpen(plan)} style={{ width: "100%", border: `1.5px solid ${LINE}`, background: "white", color: INK, fontFamily: FB, fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 14, cursor: "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><MessageCircle size={16} /> Ver comentarios {plan.commentCount > 0 && `(${plan.commentCount})`}</button>
        {joined && <button onClick={onChat} style={{ width: "100%", border: `1.5px solid ${INK}`, background: "white", color: INK, fontFamily: FB, fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 14, cursor: "pointer", marginBottom: 10 }}>Ver chat del plan</button>}
      </div>
      <div style={{ position: "sticky", bottom: 0, background: CREAM, padding: "10px 20px 6px", borderTop: `1px solid ${LINE}` }}>
        <button
          onClick={() => {
            if (info.kind === "leave" || info.kind === "join") { if (!complete || info.kind === "leave") { onJoin(plan.id); setJustJoined(true); setTimeout(() => setJustJoined(false), 900); } }
            else if (info.kind === "request") { onRequestJoin(plan.id); setJustJoined(true); setTimeout(() => setJustJoined(false), 900); }
            else if (info.kind === "cancel") onCancelRequest(plan.id);
          }}
          disabled={(complete && info.kind !== "leave") || info.kind === "rejected"}
          style={{
            width: "100%", border: "none", borderRadius: 16, padding: 16, fontFamily: FB, fontWeight: 700, fontSize: 15.5,
            cursor: (complete && info.kind !== "leave") || info.kind === "rejected" ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: complete && info.kind !== "leave" ? LIME : info.kind === "leave" || info.kind === "cancel" ? "white" : info.kind === "rejected" ? LINE : BRAND,
            color: complete && info.kind !== "leave" ? INK : info.kind === "leave" ? BRAND_DARK : info.kind === "cancel" ? MUTED : info.kind === "rejected" ? MUTED : "white",
            border: (info.kind === "leave" || info.kind === "cancel") && !complete ? `1.5px solid ${BRAND}` : "none",
            transform: justJoined ? "scale(1.03)" : "scale(1)", transition: "transform .2s",
          }}
        >
          {complete && info.kind !== "leave" ? "🎉 Plan completo" : info.kind === "leave" ? <><Check size={17} /> Apuntado</> : info.label}
        </button>
        {info.kind === "join" && !complete && <p style={{ textAlign: "center", fontFamily: FB, fontSize: 11.5, color: MUTED, margin: "8px 0 14px" }}>¿Te apuntas o qué? 😏</p>}
        {info.kind === "request" && <p style={{ textAlign: "center", fontFamily: FB, fontSize: 11.5, color: MUTED, margin: "8px 0 14px" }}>El creador revisa tu solicitud antes de sumarte 💜</p>}
        {info.kind === "cancel" && <p style={{ textAlign: "center", fontFamily: FB, fontSize: 11.5, color: MUTED, margin: "8px 0 14px" }}>Toca el botón para cancelar tu solicitud</p>}
        {(info.kind === "leave" || complete || info.kind === "rejected") && <div style={{ height: 14 }} />}
      </div>
      {requestsSheetOpen && (
        <JoinRequestsSheet
          plan={plan}
          onClose={() => setRequestsSheetOpen(false)}
          onResolved={() => { loadPendingCount(); loadParticipants(); }}
          onChat={onChat}
        />
      )}
    </div>
  );
}

function Profile({ person, onBack, mine }) {
  // person.realPlans viene siempre de CreatorProfile con los planes reales de
  // ese usuario desde public.plans. Se deja esta comprobación por seguridad
  // (por si en el futuro Profile se invoca desde otro lado sin ese campo), y
  // en ese caso se muestra un estado vacío en vez de planes inventados.
  const hasRealPlans = Array.isArray(person.realPlans);
  // Mismo criterio con las estadísticas: si algún día se llama a Profile sin
  // estos campos, se oculta la fila en vez de mostrar "undefined".
  const hasStats = person.planesCreados != null && person.planesAsistidos != null;
  // Seguidores/seguidos y el botón Seguir: CreatorProfile siempre los pasa;
  // si faltaran, se ocultan en vez de romper el render.
  const hasFollowInfo = person.followerCount != null;
  return (
    <div style={{ background: CREAM, minHeight: 560 }}>
      <TopBar title={mine ? "Tu perfil" : "Perfil"} onBack={onBack} />
      <div style={{ padding: "10px 20px 24px", textAlign: "center" }}>
        <div style={{ margin: "10px auto 14px" }}><Avatar photo={person.photo} avatarUrl={person.avatarUrl} color={person.color} initial={person.name[0]} size={80} ring={false} /></div>
        <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 20, color: INK, margin: "0 0 2px" }}>{person.name}{person.age ? `, ${person.age}` : ""}</p>
        {person.username && <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "0 0 8px" }}>@{person.username}</p>}
        {person.city && <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, margin: "0 0 8px" }}><MapPin size={12} style={{ verticalAlign: -1 }} /> {person.city}</p>}

        {hasFollowInfo && (
          <div style={{ display: "flex", justifyContent: "center", gap: 22, margin: "4px 0 14px" }}>
            <div><p style={{ fontFamily: FD, fontWeight: 700, fontSize: 15, margin: 0, color: INK }}>{person.followerCount}</p><p style={{ fontFamily: FB, fontSize: 11.5, margin: 0, color: MUTED }}>seguidores</p></div>
            <div><p style={{ fontFamily: FD, fontWeight: 700, fontSize: 15, margin: 0, color: INK }}>{person.followingCount}</p><p style={{ fontFamily: FB, fontSize: 11.5, margin: 0, color: MUTED }}>siguiendo</p></div>
          </div>
        )}
        {person.onToggleFollow && (
          <button
            onClick={person.onToggleFollow}
            disabled={person.followBusy}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, margin: "0 0 16px",
              border: person.isFollowing ? `1.5px solid ${LINE}` : "none",
              background: person.isFollowing ? "white" : BRAND,
              color: person.isFollowing ? INK : "white",
              fontFamily: FB, fontWeight: 700, fontSize: 13, padding: "10px 22px", borderRadius: 20,
              cursor: person.followBusy ? "default" : "pointer",
            }}
          >
            {person.isFollowing ? <><UserCheck size={14} /> Siguiendo</> : <><UserPlus size={14} /> Seguir</>}
          </button>
        )}

        {person.isPrivate ? (
          <div style={{ textAlign: "center", padding: "28px 20px", background: "white", border: `1.5px dashed ${LINE}`, borderRadius: 16, marginTop: 4 }}>
            <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 14.5, color: INK, margin: "0 0 4px" }}>Esta cuenta es privada</p>
            <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: 0 }}>Su bio, intereses y planes no son visibles.</p>
          </div>
        ) : (
          <>
        {person.bio && <p style={{ fontFamily: FB, fontSize: 14, color: INK, margin: "0 0 12px" }}>"{person.bio}"</p>}
        {person.interests?.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>{person.interests.map((e, i) => <span key={i} style={{ fontSize: 13, fontFamily: FB, fontWeight: 600, background: "white", border: `1px solid ${LINE}`, borderRadius: 12, padding: "7px 11px", color: INK }}>{e}</span>)}</div>
        )}
        {person.likes?.length > 0 && <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "0 0 4px" }}>Le gusta: {person.likes.join(" · ")}</p>}
        {person.rating != null && <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 13, color: INK, margin: "0 0 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Star size={13} fill={LIME} color={LIME} /> {person.rating}</p>}
        {hasStats && (
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <div style={{ flex: 1, background: "white", border: `1px solid ${LINE}`, borderRadius: 14, padding: 14 }}><p style={{ fontFamily: FD, fontWeight: 700, fontSize: 18, margin: 0, color: INK }}>{person.planesCreados}</p><p style={{ fontFamily: FB, fontSize: 11.5, margin: 0, color: MUTED }}>planes creados</p></div>
            <div style={{ flex: 1, background: "white", border: `1px solid ${LINE}`, borderRadius: 14, padding: 14 }}><p style={{ fontFamily: FD, fontWeight: 700, fontSize: 18, margin: 0, color: INK }}>{person.planesAsistidos}</p><p style={{ fontFamily: FB, fontSize: 11.5, margin: 0, color: MUTED }}>planes a los que fue</p></div>
          </div>
        )}
        <div style={{ textAlign: "left" }}>
          <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 13, color: INK, margin: "0 0 10px" }}>Planes creados</p>
          {hasRealPlans ? (
            person.realPlans.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {/* Sin foto propia: antes caía en una foto de stock de loremflickr
                    compartida por categoría (ej. cualquier plan de "Playa" mostraba
                    la MISMA foto de playa genérica, sin relación con ese plan real).
                    Ahora usa el mismo tratamiento que ya tienen Feed/Detalle: color +
                    emoji de la categoría (CAT_COLORS/CAT_EMOJI), nunca una foto que no
                    es del plan. El título real sigue mostrándose siempre encima. */}
                {person.realPlans.map((p) => (
                  <div key={p.id} style={{ position: "relative", height: 90, borderRadius: 12, overflow: "hidden", display: "flex", alignItems: "flex-end", background: p.photo_url ? `#eee url(${p.photo_url}) center/cover no-repeat` : `${CAT_COLORS[p.category] || BRAND}` }}>
                    {!p.photo_url && (
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, opacity: 0.55 }}>{CAT_EMOJI?.[p.category] || "📍"}</span>
                    )}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,10,20,0) 45%, rgba(15,10,20,0.75) 100%)" }} />
                    <span style={{ position: "relative", display: "block", width: "100%", boxSizing: "border-box", padding: "6px 8px", fontFamily: FB, fontWeight: 700, fontSize: 10.5, color: "white", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>{p.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "22px 14px", background: "white", border: `1.5px dashed ${LINE}`, borderRadius: 14 }}>
                <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 13.5, color: INK, margin: "0 0 4px" }}>Todavía no creó planes</p>
                <p style={{ fontFamily: FB, fontSize: 12, color: MUTED, margin: 0 }}>Cuando cree uno, aparecerá aquí.</p>
              </div>
            )
          ) : (
            <div style={{ textAlign: "center", padding: "22px 14px", background: "white", border: `1.5px dashed ${LINE}`, borderRadius: 14 }}>
              <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 13.5, color: INK, margin: "0 0 4px" }}>Todavía no creó planes</p>
              <p style={{ fontFamily: FB, fontSize: 12, color: MUTED, margin: 0 }}>Cuando cree uno, aparecerá aquí.</p>
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}

// Perfil público real del creador de un plan (public.profiles: display_name, username,
// avatar_url, bio, city, interests, profile_is_public). Reutiliza el mismo componente
// Profile y el mismo patrón de carga/error que el resto de la app (ver ChatScreen, loadPlans).
// Además agrega seguidores/seguidos/Seguir usando la tabla nueva public.follows.
function CreatorProfile({ personId, onBack }) {
  const { user } = useAuth();
  const isSelf = !!user && user.id === personId;
  const [profile, setProfile] = useState(null);
  const [realPlans, setRealPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    let { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, bio, city, interests, profile_is_public")
      .eq("id", personId)
      .single();
    // Si `profile_is_public` (u otra columna nueva) todavía no existe en este
    // proyecto de Supabase, Postgrest devuelve un error para toda la fila en
    // vez de solo esa columna. En lugar de romper el perfil entero, se
    // reintenta sin esa columna y se trata el perfil como público por
    // defecto (mismo comportamiento que ya tiene el resto del código para
    // profile_is_public == null/undefined). No se toca SQL ni RLS.
    if (error && /column|profile_is_public/i.test(error.message || "")) {
      const retry = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, bio, city, interests")
        .eq("id", personId)
        .single();
      data = retry.data ? { ...retry.data, profile_is_public: null } : null;
      error = retry.error;
    }
    if (error) {
      console.error("[Profile] Error cargando perfil del creador:", error.message);
      setLoadError("No pudimos cargar este perfil.");
      setLoading(false);
      return;
    }
    setProfile(data);

    // Seguidores/seguidos: dos counts livianos (head:true → no trae filas, solo el total).
    const { count: followers, error: followersError } = await supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", personId);
    if (followersError) console.error("[Follows] Error contando seguidores:", followersError.message);
    setFollowerCount(followers ?? 0);

    const { count: following, error: followingError } = await supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", personId);
    if (followingError) console.error("[Follows] Error contando seguidos:", followingError.message);
    setFollowingCount(following ?? 0);

    if (user && !isSelf) {
      const { data: followRow, error: followRowError } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", personId)
        .maybeSingle();
      if (followRowError) console.error("[Follows] Error consultando si ya sigue:", followRowError.message);
      setIsFollowing(!!followRow);
    }

    // Los planes solo se muestran si el perfil es público (o si es mi propio perfil).
    // Si es privado y no soy yo, ni siquiera hace falta pedirlos.
    const isPublic = data.profile_is_public !== false;
    if (isPublic || isSelf) {
      const { data: planRows, error: plansError } = await supabase
        .from("plans")
        .select("id, title, category, photo_url, starts_at")
        .eq("creator_id", personId)
        .order("starts_at", { ascending: false })
        .limit(6);
      if (plansError) {
        console.error("[Profile] Error cargando planes del creador:", plansError.message);
        setRealPlans([]);
      } else {
        setRealPlans(planRows || []);
      }
    } else {
      setRealPlans([]);
    }

    setLoading(false);
  }, [personId, user, isSelf]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const toggleFollow = async () => {
    if (!user) return;
    if (followBusy || isSelf) return;
    const wasFollowing = isFollowing;
    setFollowBusy(true);
    // Optimista, mismo patrón que handleJoin/handleSave/handleLike en QueSaleApp.
    setIsFollowing(!wasFollowing);
    setFollowerCount((c) => Math.max(0, c + (wasFollowing ? -1 : 1)));

    if (wasFollowing) {
      const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", personId);
      if (error) {
        console.error("[Follows] Error al dejar de seguir:", error.message);
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: personId });
      if (error) {
        if (error.code === "23505") {
          // Ya existía la fila: no es un error real.
        } else {
          console.error("[Follows] Error al seguir:", error.message);
          setIsFollowing(false);
          setFollowerCount((c) => Math.max(0, c - 1));
        }
      } else {
        try {
          await supabase.from("notifications").insert({ user_id: personId, actor_id: user.id, message: "empezó a seguirte" });
        } catch (e) {
          console.error("[Follows] Error creando notificación (no bloqueante):", e);
        }
      }
    }
    setFollowBusy(false);
  };

  if (loading) return <LoadingBlock text="Cargando perfil…" />;
  if (loadError || !profile) return <ErrorBlock text={loadError || "No encontramos este perfil."} onRetry={loadProfile} />;

  const isPrivate = profile.profile_is_public === false && !isSelf;

  // Mapeo a la misma forma que ya espera Profile; los campos que no existen en
  // public.profiles (edad, likes, rating, conteo de asistidos) quedan sin definir
  // a propósito, y Profile() ya sabe ocultarlos en vez de mostrar "undefined".
  const person = {
    name: profile.display_name || profile.username || "Usuario",
    username: profile.username || null,
    avatarUrl: profile.avatar_url || null,
    color: BRAND,
    city: profile.city || "",
    bio: profile.bio || "",
    interests: profile.interests || [],
    likes: [],
    planesCreados: realPlans.length,
    realPlans,
    isPrivate,
    followerCount,
    followingCount,
    isFollowing,
    followBusy,
    onToggleFollow: user && !isSelf ? toggleFollow : null,
  };
  return <Profile person={person} onBack={onBack} mine={false} />;
}

function ChatScreen({ plan, onBack, onToast }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Chat] Error cargando mensajes:", error.message);
      setLoadError("No pudimos cargar el chat. Verifica tu conexión.");
      setLoading(false);
      return;
    }

    // Mismo formato { from, text } que ya usaba el diseño: "me" para mensajes propios
    // (el render solo distingue mío vs. no mío, así que la burbuja no cambia).
    setMessages((data || []).map((row) => ({
      id: row.id,
      from: user && row.user_id === user.id ? "me" : row.user_id,
      text: row.content,
    })));
    setLoading(false);
  }, [plan.id, user]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const send = async () => {
    const content = text.trim();
    if (!content || !user || sending) return;

    setSending(true);
    setText("");

    const { data: row, error } = await supabase
      .from("messages")
      .insert({ plan_id: plan.id, user_id: user.id, content })
      .select()
      .single();

    if (error) {
      console.error("[Chat] Error enviando mensaje:", error.message);
      setText(content); // no perdemos lo que el usuario escribió
      if (onToast) onToast("No pudimos enviar tu mensaje. Intenta de nuevo.");
      setSending(false);
      return;
    }

    setMessages((prev) => [...prev, { id: row.id, from: "me", text: row.content }]);
    setSending(false);
  };

  return (
    <div style={{ background: CREAM, minHeight: 560, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${LINE}`, background: "white" }}>
        <button onClick={onBack} style={{ border: "none", background: LINE, borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={17} color={INK} /></button>
        <div style={{ width: 32, height: 32, borderRadius: 10, position: "relative", background: planCardBg(plan) }}>
          {!plan.photoUrl && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{CAT_EMOJI?.[plan.category] || "📍"}</span>}
        </div>
        <div><p style={{ fontFamily: FB, fontWeight: 700, fontSize: 13.5, margin: 0, color: INK }}>{plan.title}</p><p style={{ fontFamily: FB, fontSize: 11.5, margin: 0, color: MUTED }}>{plan.time} · {plan.joined} participantes</p></div>
      </div>
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {loading && <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, textAlign: "center", margin: "20px 0" }}>Cargando mensajes…</p>}
        {!loading && loadError && <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, textAlign: "center", margin: "20px 0" }}>{loadError}</p>}
        {!loading && !loadError && messages.map((m, i) => (<div key={m.id || i} style={{ display: "flex", justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}><div style={{ maxWidth: "75%", padding: "9px 13px", borderRadius: 16, background: m.from === "me" ? BRAND : "white", color: m.from === "me" ? "white" : INK, border: m.from === "me" ? "none" : `1px solid ${LINE}`, fontFamily: FB, fontSize: 13.5 }}>{m.text}</div></div>))}
      </div>
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 20px" }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escribe un mensaje" style={{ flex: 1, fontFamily: FB, fontSize: 13.5, padding: "12px 14px", borderRadius: 20, border: `1.5px solid ${LINE}`, outline: "none" }} />
        <button onClick={send} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: BRAND, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={16} color="white" /></button>
      </div>
    </div>
  );
}

const NOTIFICATION_COLORS = [BRAND, "#3FBF9B", "#8B76FF", LIVE, "#F0679D"];

function relativeTimeFromNow(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "hace un momento";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour} h`;
  const diffDay = Math.floor(diffHour / 24);
  return `hace ${diffDay} día${diffDay === 1 ? "" : "s"}`;
}

function Activity() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadNotifications = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);

    const { data: rows, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Activity] Error cargando notificaciones:", error.message);
      setLoadError("No pudimos cargar tu actividad.");
      setItems([]);
      setLoading(false);
      return;
    }

    // Mismo patrón que en loadPlans: resolvemos el nombre del actor con un solo
    // select adicional a profiles, usando las mismas columnas que ya usa el resto de la app.
    const actorIds = [...new Set((rows || []).map((r) => r.actor_id).filter(Boolean))];
    let profilesById = {};
    if (actorIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", actorIds);
      if (profileError) {
        console.error("[Activity] Error cargando perfiles de actividad:", profileError.message);
        // No es fatal: mostramos las notificaciones igual, solo sin nombre de actor.
      } else {
        profilesById = Object.fromEntries((profileRows || []).map((p) => [p.id, p]));
      }
    }

    setItems((rows || []).map((row) => {
      const prof = row.actor_id ? profilesById[row.actor_id] : null;
      const name = prof?.display_name || prof?.username || null;
      return {
        id: row.id,
        name: name || "—",
        action: row.message || "Tienes una nueva notificación.",
        time: relativeTimeFromNow(row.created_at),
        color: NOTIFICATION_COLORS[hashStr(row.actor_id || row.id) % NOTIFICATION_COLORS.length],
        avatarUrl: prof?.avatar_url || null,
      };
    }));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  return (
    <div style={{ background: CREAM, minHeight: 560 }}>
      <div style={{ padding: "20px 16px 10px" }}><p style={{ fontFamily: FD, fontWeight: 700, fontSize: 20, margin: 0, color: INK }}>Actividad</p></div>
      <div style={{ padding: "0 16px" }}>
        {loading && (
          <p style={{ fontFamily: FB, fontSize: 13.5, color: MUTED, textAlign: "center", margin: "40px 0" }}>Cargando actividad…</p>
        )}
        {!loading && loadError && (
          <p style={{ fontFamily: FB, fontSize: 13.5, color: MUTED, textAlign: "center", margin: "40px 0" }}>{loadError}</p>
        )}
        {!loading && !loadError && items.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 15, color: INK, margin: "0 0 6px" }}>Todavía no tienes actividad</p>
            <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.4 }}>Cuando alguien se apunte a tus planes o escriba en ellos, aparecerá aquí.</p>
          </div>
        )}
        {!loading && !loadError && items.map((a) => (
          <div key={a.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${LINE}` }}>
            <Avatar color={a.color} initial={a.name === "—" ? "!" : a.name[0]} avatarUrl={a.avatarUrl} size={38} ring={false} />
            <p style={{ flex: 1, fontFamily: FB, fontSize: 13.5, color: INK, margin: 0, lineHeight: 1.4 }}>{a.name !== "—" && <span style={{ fontWeight: 700 }}>{a.name} </span>}{a.action}</p>
            <span style={{ fontFamily: FB, fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingBlock({ text }) {
  return (
    <div style={{ minHeight: 560, display: "flex", alignItems: "center", justifyContent: "center", background: CREAM }}>
      <p style={{ fontFamily: FB, fontSize: 13.5, color: MUTED }}>{text}</p>
    </div>
  );
}
function ErrorBlock({ text, onRetry }) {
  return (
    <div style={{ minHeight: 560, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: CREAM, padding: 24, textAlign: "center", gap: 14 }}>
      <p style={{ fontFamily: FB, fontSize: 13.5, color: MUTED }}>{text}</p>
      <button onClick={onRetry} style={{ border: "none", background: BRAND, color: "white", fontFamily: FB, fontWeight: 700, fontSize: 13.5, padding: "10px 20px", borderRadius: 12, cursor: "pointer" }}>Reintentar</button>
    </div>
  );
}

/* ---------- App shell ---------- */
export default function QueSaleApp() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { user, profile, loading: authLoading } = useAuth();
  const [stack, setStack] = useState([{ screen: "landing" }]);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [savedIds, setSavedIds] = useState(new Set());
  const [likedIds, setLikedIds] = useState(new Set());
  // Mis propias solicitudes a planes que requieren aprobación: { [planId]: "pending" | "accepted" | "rejected" }.
  const [requestStatusByPlan, setRequestStatusByPlan] = useState({});
  const [filter, setFilter] = useState("Todos");
  const [tab, setTab] = useState("hoy");
  const [story, setStory] = useState(null);
  const [onboarded, setOnboarded] = useState(false);
  const [interests, setInterests] = useState([]);

  // Persistencia real de "¿Qué te late?": antes onboarded/interests vivían solo
  // en useState (se perdían al recargar). Ahora:
  // - con sesión: la fuente de verdad es profiles.interests (columna ya existente).
  //   null = todavía no completó el onboarding; array (incluso []) = ya lo completó,
  //   sea con intereses elegidos o con "Omitir".
  // - sin sesión: no hay fila de profiles que leer, así que se usa localStorage
  //   como respaldo en este dispositivo/navegador.
  useEffect(() => {
    if (user) {
      if (profile && profile.interests !== undefined && profile.interests !== null) {
        setOnboarded(true);
        setInterests(profile.interests || []);
      }
    } else if (typeof window !== "undefined") {
      if (window.localStorage.getItem("qs_onboarded") === "1") setOnboarded(true);
    }
  }, [user, profile]);
  const [shareState, setShareState] = useState(null);
  const [commentsState, setCommentsState] = useState(null);
  const [toast, setToast] = useState(null);
  // Solo lo usa DiscoverMap, para avisar cuando la vista inmersiva de un plan está
  // abierta y así ocultar el bottom nav mientras dura (se restaura solo al cerrarla).
  const [mapHeroActive, setMapHeroActive] = useState(false);

  // Carga real de planes desde Supabase (public.plans), + los perfiles de sus creadores
  // (consulta aparte a public.profiles por creator_id, ya que no hay una relación de
  // Supabase configurada entre plans y profiles para pedirlo en un solo select anidado).
  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);

    // Sin esto, un plan cuya hora ya pasó hace días se sigue mostrando para siempre
    // en el feed (bucketForStartsAt lo etiqueta como "hoy" indefinidamente si no hay
    // match exacto de fecha). 3h de margen coincide con la ventana que el propio
    // bucketForStartsAt ya usa para considerar un plan como "ahora".
    const cutoffIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from("plans")
      .select("*")
      .gte("starts_at", cutoffIso)
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("[Plans] Error cargando planes:", error.message);
      setPlansError("No pudimos cargar los planes. Verifica tu conexión e inténtalo de nuevo.");
      setPlansLoading(false);
      return;
    }

    const creatorIds = [...new Set((rows || []).map((r) => r.creator_id).filter(Boolean))];
    let profilesById = {};
    if (creatorIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", creatorIds);
      if (profileError) {
        console.error("[Plans] Error cargando perfiles de creadores:", profileError.message);
        // No es fatal: mostramos los planes igual, con un nombre genérico de creador.
      } else {
        for (const p of profileRows || []) profilesById[p.id] = p;
      }
    }

    // Participantes reales desde public.plan_participants: contamos cuántos hay por plan
    // y cuáles incluyen al usuario actual, para que "Me apunto" refleje el estado real
    // guardado en Supabase (persiste igual después de recargar la página).
    const planIds = (rows || []).map((r) => r.id);
    const countByPlan = {};
    const joinedSet = new Set();
    if (planIds.length > 0) {
      const { data: participantRows, error: participantsError } = await supabase
        .from("plan_participants")
        .select("plan_id, user_id")
        .in("plan_id", planIds);
      if (participantsError) {
        console.error("[Participants] Error cargando participantes:", participantsError.message);
        // No es fatal: mostramos los planes igual, aunque sin contador de participantes exacto.
      } else {
        for (const p of participantRows || []) {
          countByPlan[p.plan_id] = (countByPlan[p.plan_id] || 0) + 1;
          if (user && p.user_id === user.id) joinedSet.add(p.plan_id);
        }
      }
    }

    // Favoritos reales desde public.favorites: RLS ya limita esto a los del usuario actual,
    // así el botón Guardar refleja el estado real guardado en Supabase tras recargar la página.
    const savedSet = new Set();
    if (user) {
      const { data: favoriteRows, error: favoritesError } = await supabase
        .from("favorites")
        .select("plan_id")
        .eq("user_id", user.id);
      if (favoritesError) {
        console.error("[Favorites] Error cargando favoritos:", favoritesError.message);
        // No es fatal: mostramos los planes igual, aunque sin favoritos marcados.
      } else {
        for (const f of favoriteRows || []) savedSet.add(f.plan_id);
      }
    }

    // Likes reales desde public.plan_likes: mismo patrón que plan_participants
    // (un solo select por lote, contamos por plan y marcamos los del usuario actual).
    const likeCountByPlan = {};
    const likedSet = new Set();
    if (planIds.length > 0) {
      const { data: likeRows, error: likesError } = await supabase
        .from("plan_likes")
        .select("plan_id, user_id")
        .in("plan_id", planIds);
      if (likesError) {
        console.error("[Likes] Error cargando likes:", likesError.message);
        // No es fatal: mostramos los planes igual, aunque sin contador de likes exacto.
      } else {
        for (const l of likeRows || []) {
          likeCountByPlan[l.plan_id] = (likeCountByPlan[l.plan_id] || 0) + 1;
          if (user && l.user_id === user.id) likedSet.add(l.plan_id);
        }
      }
    }

    // Comentarios reales desde public.plan_comments: solo necesitamos el conteo por
    // plan para las tarjetas/detalle; el contenido se carga aparte al abrir el panel.
    const commentCountByPlan = {};
    if (planIds.length > 0) {
      const { data: commentRows, error: commentsError } = await supabase
        .from("plan_comments")
        .select("plan_id")
        .in("plan_id", planIds);
      if (commentsError) {
        console.error("[Comments] Error cargando conteo de comentarios:", commentsError.message);
      } else {
        for (const c of commentRows || []) commentCountByPlan[c.plan_id] = (commentCountByPlan[c.plan_id] || 0) + 1;
      }
    }

    setPlans((rows || []).map((row) => normalizePlanRow(
      row,
      profilesById,
      countByPlan[row.id] || 0,
      joinedSet.has(row.id),
      likeCountByPlan[row.id] || 0,
      likedSet.has(row.id),
      commentCountByPlan[row.id] || 0
    )));
    setJoinedIds(joinedSet);
    setSavedIds(savedSet);
    setLikedIds(likedSet);

    // Mis solicitudes pendientes/resueltas en planes con aprobación (para que el
    // botón muestre "Solicitud enviada"/"Solicitud rechazada" tras recargar).
    if (user && planIds.length > 0) {
      const { data: requestRows, error: requestsError } = await supabase
        .from("plan_join_requests")
        .select("plan_id, status")
        .eq("user_id", user.id)
        .in("plan_id", planIds);
      if (requestsError) {
        console.error("[JoinRequests] Error cargando mis solicitudes:", requestsError.message);
      } else {
        setRequestStatusByPlan(Object.fromEntries((requestRows || []).map((r) => [r.plan_id, r.status])));
      }
    } else {
      setRequestStatusByPlan({});
    }

    setPlansLoading(false);
  }, [user]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // Recupera los intereses guardados en public.profiles al iniciar sesión, para que el
  // onboarding no se repita en cada recarga si el usuario ya los eligió antes.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("interests")
        .eq("id", user.id)
        .single();
      if (error) {
        console.error("[Profile] Error cargando intereses guardados:", error.message);
        return;
      }
      if (data?.interests && data.interests.length > 0) {
        setInterests(data.interests);
        setOnboarded(true);
      }
    })();
  }, [user]);

  const current = stack[stack.length - 1];
  const push = (screen, params = {}) => setStack([...stack, { screen, ...params }]);
  const goBack = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const navBottom = (key) => {
    // El botón "+" (Crear) debe apilarse sobre la pantalla actual, igual que
    // ya hace push() desde el botón "Crear mi primer plan" del Feed, en vez
    // de reemplazar todo el stack: así el botón de volver que ya existe
    // dentro de QuickCreate (ChevronLeft -> onCancel -> goBack) tiene una
    // pantalla anterior a la cual regresar. El resto de tabs de la barra
    // inferior (feed/discover/activity/profile) conserva exactamente el
    // mismo comportamiento de siempre: resetear el stack a una sola pantalla.
    if (key === "create") {
      setStack((s) => [...s, { screen: "create" }]);
      return;
    }
    setStack([{ screen: key }]);
  };
  const showToast = (t) => { setToast(t); setTimeout(() => setToast(null), 1700); };
  const handleJoin = async (id) => {
    if (!user) {
      showToast("Inicia sesión para apuntarte 🙌");
      return;
    }
    const alreadyJoined = joinedIds.has(id);

    // Actualización optimista: el botón responde al toque; si Supabase falla, revertimos.
    setJoinedIds((prev) => { const n = new Set(prev); alreadyJoined ? n.delete(id) : n.add(id); return n; });

    if (alreadyJoined) {
      const { error } = await supabase.from("plan_participants").delete().eq("plan_id", id).eq("user_id", user.id);
      if (error) {
        console.error("[Participants] Error al salir del plan:", error.message);
        setJoinedIds((prev) => new Set(prev).add(id)); // revertir
        showToast("No pudimos actualizar tu apunte. Intenta de nuevo.");
      }
    } else {
      const { error } = await supabase.from("plan_participants").insert({ plan_id: id, user_id: user.id });
      if (error) {
        if (error.code === "23505") {
          // Ya existía la fila (doble clic, etc.): no es un error real, solo sincronizamos el estado.
        } else {
          console.error("[Participants] Error al apuntarse:", error.message);
          setJoinedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); // revertir
          showToast("No pudimos apuntarte. Intenta de nuevo.");
        }
      }
    }
  };
  const handleSave = async (id) => {
    if (!user) {
      showToast("Inicia sesión para guardar planes 🙌");
      return;
    }
    const alreadySaved = savedIds.has(id);

    // Misma mecánica que "Me apunto": actualización optimista + reversión si Supabase falla.
    setSavedIds((prev) => { const n = new Set(prev); alreadySaved ? n.delete(id) : n.add(id); return n; });
    showToast(alreadySaved ? "Quitado de guardados" : "Guardado 🔖");

    if (alreadySaved) {
      const { error } = await supabase.from("favorites").delete().eq("plan_id", id).eq("user_id", user.id);
      if (error) {
        console.error("[Favorites] Error al quitar de guardados:", error.message);
        setSavedIds((prev) => new Set(prev).add(id)); // revertir
        showToast("No pudimos actualizar tus guardados. Intenta de nuevo.");
      }
    } else {
      const { error } = await supabase.from("favorites").insert({ plan_id: id, user_id: user.id });
      if (error) {
        if (error.code === "23505") {
          // Ya existía la fila (doble clic, etc.): no es un error real, solo sincronizamos el estado.
        } else {
          console.error("[Favorites] Error al guardar:", error.message);
          setSavedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); // revertir
          showToast("No pudimos guardar el plan. Intenta de nuevo.");
        }
      }
    }
  };
  // "Solicitar unirme" (planes con join_policy = 'approval'): NO toca plan_participants
  // directo — crea una fila pendiente. La RLS de plan_participants (ver join-requests.sql)
  // es la que de verdad impide unirse sin aprobación, esto es solo la UI.
  const handleRequestJoin = async (id) => {
    if (!user) {
      showToast("Inicia sesión para solicitar unirte 🙌");
      return;
    }
    setRequestStatusByPlan((prev) => ({ ...prev, [id]: "pending" })); // optimista
    const { error } = await supabase.from("plan_join_requests").insert({ plan_id: id, user_id: user.id, status: "pending" });
    if (error) {
      if (error.code === "23505") {
        // Ya existía una solicitud (doble clic, o ya estaba resuelta): sincronizamos con lo real.
        const { data } = await supabase.from("plan_join_requests").select("status").eq("plan_id", id).eq("user_id", user.id).maybeSingle();
        if (data) setRequestStatusByPlan((prev) => ({ ...prev, [id]: data.status }));
      } else {
        console.error("[JoinRequests] Error al solicitar unirse:", error.message);
        setRequestStatusByPlan((prev) => { const n = { ...prev }; delete n[id]; return n; }); // revertir
        showToast("No pudimos enviar tu solicitud. Intenta de nuevo.");
        return;
      }
    }
    showToast("Solicitud enviada 🙌");
    const plan = plans.find((p) => p.id === id);
    if (plan) notify(plan.creator, "quiere unirse a tu plan");
  };
  const handleCancelRequest = async (id) => {
    if (!user) return;
    const previousStatus = requestStatusByPlan[id];
    setRequestStatusByPlan((prev) => { const n = { ...prev }; delete n[id]; return n; }); // optimista
    const { error } = await supabase.from("plan_join_requests").delete().eq("plan_id", id).eq("user_id", user.id).eq("status", "pending");
    if (error) {
      console.error("[JoinRequests] Error al cancelar la solicitud:", error.message);
      setRequestStatusByPlan((prev) => ({ ...prev, [id]: previousStatus })); // revertir
      showToast("No pudimos cancelar tu solicitud. Intenta de nuevo.");
    } else {
      showToast("Solicitud cancelada");
    }
  };
  // patrón simple de mensaje libre que ya usa Activity() para leer `message`.
  const notify = async (recipientId, message) => {
    if (!user || !recipientId || recipientId === user.id) return; // nunca te notificas a ti mismo
    try {
      const { error } = await supabase.from("notifications").insert({ user_id: recipientId, actor_id: user.id, message });
      if (error) console.error("[Notify] Error creando notificación:", error.message);
    } catch (e) {
      console.error("[Notify] Excepción creando notificación:", e);
    }
  };
  const handleLike = async (id) => {
    if (!user) {
      showToast("Inicia sesión para dar like 🙌");
      return;
    }
    const alreadyLiked = likedIds.has(id);
    setLikedIds((prev) => { const n = new Set(prev); alreadyLiked ? n.delete(id) : n.add(id); return n; });

    if (alreadyLiked) {
      const { error } = await supabase.from("plan_likes").delete().eq("plan_id", id).eq("user_id", user.id);
      if (error) {
        console.error("[Likes] Error al quitar like:", error.message);
        setLikedIds((prev) => new Set(prev).add(id)); // revertir
        showToast("No pudimos actualizar tu like. Intenta de nuevo.");
      }
    } else {
      const { error } = await supabase.from("plan_likes").insert({ plan_id: id, user_id: user.id });
      if (error) {
        if (error.code === "23505") {
          // Ya existía la fila: no es un error real, solo sincronizamos el estado.
        } else {
          console.error("[Likes] Error al dar like:", error.message);
          setLikedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); // revertir
          showToast("No pudimos dar like. Intenta de nuevo.");
        }
      } else {
        const likedPlan = plans.find((p) => p.id === id);
        if (likedPlan) notify(likedPlan.creator, "le dio like a tu plan");
      }
    }
  };
  // Suma en memoria un comentario recién publicado, para que el contador de la
  // tarjeta/detalle quede al día sin tener que recargar todos los planes.
  const bumpCommentCount = (id) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p)));
  };
  // Elimina un plan propio (RLS en Supabase ya impide borrar planes ajenos; el
  // .eq("creator_id", user.id) es una defensa extra en el cliente). Al terminar,
  // refresca la lista real desde Supabase y vuelve al feed, porque el plan
  // eliminado ya no existe para mostrarlo en el detalle.
  const handleDeletePlan = async (id) => {
    if (!user) return false;
    const { error } = await supabase.from("plans").delete().eq("id", id).eq("creator_id", user.id);
    if (error) {
      console.error("[Plans] Error eliminando plan:", error.message);
      showToast("No pudimos cancelar el plan. Intenta de nuevo.");
      return false;
    }
    await loadPlans();
    setStack([{ screen: "feed" }]);
    showToast("Plan cancelado y eliminado 🗑️");
    return true;
  };

  // Se llama después de guardar una edición exitosa en EditPlan: refresca los
  // planes reales desde Supabase (para que el detalle muestre los cambios) y
  // vuelve a la pantalla anterior (el detalle del plan).
  const handlePlanUpdated = async () => {
    await loadPlans();
    goBack();
    showToast("✅ Plan actualizado");
  };

  const goLanding = (target) => (onboarded ? setStack([{ screen: target }]) : push("onboarding", { after: target }));

  // Guarda los intereses elegidos en public.profiles cuando hay sesión iniciada, para que
  // persistan al recargar la página (si no hay sesión, quedan solo en memoria como antes).
  const persistInterests = async (its) => {
    // Respaldo local inmediato (cubre el caso sin sesión, donde no existe fila de
    // profiles que actualizar): así "Omitir" también persiste entre recargas.
    if (typeof window !== "undefined") window.localStorage.setItem("qs_onboarded", "1");
    if (!user) return;
    // Se escribe SIEMPRE, incluso con [] (Omitir), para distinguir "ya completó
    // el onboarding sin elegir nada" (interests: []) de "todavía no lo completó"
    // (interests: null, el valor por defecto de la columna).
    const { error } = await supabase.from("profiles").update({ interests: its || [] }).eq("id", user.id);
    if (error) console.error("[Profile] Error guardando intereses:", error.message);
  };

  const finishOnboarding = (its, avs) => { setInterests(its); setOnboarded(true); setStack([{ screen: current.after || "feed" }]); persistInterests(its); };

  const handlePublish = async (draft) => {
    // Seguridad: el creator_id SIEMPRE sale del usuario autenticado real, nunca del formulario.
    if (!user) {
      setPublishError("Debes iniciar sesión para publicar un plan.");
      return;
    }
    setPublishError(null);
    setPublishing(true);

    const missingCount = draft.count === "5+" ? 5 : (parseInt(draft.count, 10) || 1);
    const isGroup = draft.mode === "grupo";
    const startsAt = draftWhenToStartsAtIso(draft.when.key, draft.time);
    // Coordenadas reales del pin: ahora QuickCreate ya las resuelve ANTES de
    // habilitar el botón de publicar, según lo que la persona haya elegido —
    // "📍 Cerca de mí" (su GPS actual) o "📍 Elegir ubicación" (un punto marcado
    // a mano en el mapa, para cuando el plan es en otro lugar). Antes acá se
    // llamaba SIEMPRE a getCurrentCoords al publicar, sin importar el texto de
    // ubicación escrito arriba. Se deja el flujo anterior como red de
    // seguridad únicamente si por algún motivo draft.coords no llegara resuelto.
    let coords = draft.coords || null;
    let errorCode = null;
    if (!coords) {
      // Antes de pedir la ubicación: si el permiso ya quedó bloqueado (o el sitio no
      // está en un contexto seguro), Chrome no muestra ningún aviso nativo y
      // getCurrentCoords fallaría en silencio con el mismo error genérico de
      // siempre. Detectarlo acá permite explicarle a la persona exactamente qué
      // hacer, en vez de repetir el permiso sin que se note.
      const blocked = await checkLocationBlocked();
      if (blocked) {
        setPublishError(
          blocked === "insecure"
            ? "Tu navegador bloquea la ubicación porque este sitio no tiene una conexión segura (https). Avísale al equipo de la app."
            : "El permiso de ubicación está bloqueado para este sitio. En Chrome: toca el candado 🔒 junto a la dirección → Permisos del sitio → Ubicación → Permitir, y vuelve a intentar."
        );
        setPublishing(false);
        return;
      }
      const res = await getCurrentCoords();
      coords = res.coords;
      errorCode = res.errorCode;
    }
    // Si no se logra obtener ninguna coordenada, YA NO se publica el plan con
    // latitude/longitude en null: se informa a la persona y se detiene acá, para
    // que el plan nunca quede invisible en el mapa sin que se entere.
    if (!coords) {
      setPublishError(
        errorCode === 1
          ? "El permiso de ubicación está bloqueado para este sitio. En Chrome: toca el candado 🔒 junto a la dirección → Permisos del sitio → Ubicación → Permitir, y vuelve a intentar."
          : "No pudimos obtener tu ubicación. Revisa tu GPS/conexión y vuelve a intentarlo para poder publicar el plan."
      );
      setPublishing(false);
      return;
    }

    const payload = {
      creator_id: user.id,
      title: `¿${draft.cat.label}?`,
      description: isGroup ? `Somos 1 y buscamos ${missingCount} más.` : `Busco ${missingCount} personas, ¿quién se apunta?`,
      category: draft.cat.cat,
      location_name: draft.location,
      latitude: coords.lat,
      longitude: coords.lng,
      starts_at: startsAt,
      capacity: 1 + missingCount,
      is_group: isGroup,
      photo_url: null,
      status: "active",
      join_policy: draft.joinPolicy || "open",
    };

    const { data: row, error } = await supabase.from("plans").insert(payload).select().single();

    if (error) {
      console.error("[Plans] Error creando plan:", error.message);
      setPublishError(error.message || "No se pudo publicar el plan. Inténtalo de nuevo.");
      setPublishing(false);
      return;
    }

    const { error: participantError } = await supabase
      .from("plan_participants")
      .insert({ plan_id: row.id, user_id: user.id });

    if (participantError) {
      console.error("[Plans] Error inscribiendo al creador:", participantError.message);
      // no bloqueamos la publicación por esto; el plan ya existe
    }

    // "Destacar mi plan": todavía sin cobro real (is_paid queda en false a
    // propósito, ver plan_boosts.sql). Si falla, no bloqueamos la publicación:
    // el plan ya existe y se publicó como gratuito.
    if (draft.boost) {
      const boostStartsAt = new Date();
      const boostEndsAt = new Date(boostStartsAt.getTime() + draft.boost.hours * 60 * 60 * 1000);
      const { error: boostError } = await supabase.from("plan_boosts").insert({
        plan_id: row.id,
        creator_id: user.id,
        tier: draft.boost.key,
        duration_hours: draft.boost.hours,
        price_soles: draft.boost.price,
        starts_at: boostStartsAt.toISOString(),
        ends_at: boostEndsAt.toISOString(),
        status: "active",
        is_paid: false,
      });
      if (boostError) {
        console.error("[Boost] Error creando el destacado:", boostError.message);
      } else {
        const { error: featureError } = await supabase
          .from("plans")
          .update({ featured_until: boostEndsAt.toISOString() })
          .eq("id", row.id)
          .eq("creator_id", user.id);
        if (featureError) console.error("[Boost] Error marcando el plan como destacado:", featureError.message);
      }
    }

    await loadPlans(); // refresca el Feed/Descubrir con datos reales de Supabase, incluido el plan nuevo
    setPublishing(false);
    setStack([{ screen: "feed" }, { screen: "detail", planId: row.id }]);
    showToast("🎉 ¡Tu plan está vivo!");
  };

  let body;
  if (current.screen === "landing") body = <Landing nav={goLanding} plans={plans} plansLoading={plansLoading} />;
  else if (current.screen === "onboarding") body = <Onboarding onDone={finishOnboarding} />;
  else if (current.screen === "feed") {
    if (plansLoading) body = <LoadingBlock text="Cargando planes…" />;
    else if (plansError) body = <ErrorBlock text={plansError} onRetry={loadPlans} />;
    else body = <Feed plans={plans} joinedIds={joinedIds} savedIds={savedIds} likedIds={likedIds} requestStatusByPlan={requestStatusByPlan} onJoin={handleJoin} onSave={handleSave} onLike={handleLike} onRequestJoin={handleRequestJoin} onCancelRequest={handleCancelRequest} onOpen={(id) => push("detail", { planId: id })} onShareOpen={(p) => setShareState({ plan: p, mode: "share" })} tab={tab} setTab={setTab} story={story} setStory={setStory} nav={push} interests={interests} />;
  }
  else if (current.screen === "discover") {
    if (plansLoading) body = <LoadingBlock text="Cargando planes…" />;
    else if (plansError) body = <ErrorBlock text={plansError} onRetry={loadPlans} />;
    else body = <DiscoverMap plans={plans} joinedIds={joinedIds} savedIds={savedIds} requestStatusByPlan={requestStatusByPlan} onJoin={handleJoin} onSave={handleSave} onRequestJoin={handleRequestJoin} onCancelRequest={handleCancelRequest} onShareOpen={(p) => setShareState({ plan: p, mode: "share" })} onChat={(id) => push("chat", { planId: id })} onProfile={(id) => push("personProfile", { personId: id })} filter={filter} setFilter={setFilter} onHeroToggle={setMapHeroActive} />;
  }
  else if (current.screen === "saved") body = <Saved plans={plans} savedIds={savedIds} joinedIds={joinedIds} likedIds={likedIds} requestStatusByPlan={requestStatusByPlan} onJoin={handleJoin} onSave={handleSave} onLike={handleLike} onRequestJoin={handleRequestJoin} onCancelRequest={handleCancelRequest} onOpen={(id) => push("detail", { planId: id })} onShareOpen={(p) => setShareState({ plan: p, mode: "share" })} onBack={goBack} />;
  else if (current.screen === "create") {
    if (!onboarded) {
      body = <Onboarding onDone={(its, avs) => { setInterests(its); setOnboarded(true); persistInterests(its); }} />;
    } else if (authLoading) {
      body = <LoadingBlock text="Verificando tu sesión…" />;
    } else if (!user) {
      // Un usuario sin sesión nunca llega a ver el formulario ni puede insertar nada: solo AuthScreen.
      body = <AuthScreen />;
    } else {
      body = <QuickCreate onPublish={handlePublish} onCancel={goBack} publishing={publishing} publishError={publishError} />;
    }
  }
  else if (current.screen === "activity") body = <Activity />;
  else if (current.screen === "profile") {
    if (authLoading) {
      body = <LoadingBlock text="Verificando tu sesión…" />;
    } else if (user) {
      body = <MyAccountProfile onBack={goBack} />;
    } else {
      body = <AuthScreen />;
    }
  }
  else if (current.screen === "detail") {
    const plan = plans.find((p) => p.id === current.planId);
    if (!plan) {
      body = <LoadingBlock text={plansLoading ? "Cargando plan…" : "No encontramos este plan."} />;
    } else {
      body = <PlanDetail plan={plan} joined={joinedIds.has(plan.id)} saved={savedIds.has(plan.id)} liked={likedIds.has(plan.id)} reqStatus={requestStatusByPlan[plan.id]} onJoin={handleJoin} onSave={handleSave} onLike={handleLike} onRequestJoin={handleRequestJoin} onCancelRequest={handleCancelRequest} onBack={goBack} onChat={() => push("chat", { planId: plan.id })} onProfile={() => push("personProfile", { personId: plan.creator })} onOpenPerson={(id) => push("personProfile", { personId: id })} onShareOpen={(p) => setShareState({ plan: p, mode: "share" })} onInviteOpen={(p) => setShareState({ plan: p, mode: "invite" })} onCommentsOpen={(p) => setCommentsState({ plan: p })} onEdit={(id) => push("editPlan", { planId: id })} onDelete={handleDeletePlan} />;
    }
  }
  else if (current.screen === "editPlan") {
    const plan = plans.find((p) => p.id === current.planId);
    if (!plan) {
      body = <LoadingBlock text={plansLoading ? "Cargando plan…" : "No encontramos este plan."} />;
    } else if (!user || plan.creator !== user.id) {
      // Defensa extra en el cliente: si alguien llega aquí sin ser el creador
      // (por ejemplo manipulando la navegación), no se muestra el formulario.
      body = <ErrorBlock text="No tienes permiso para editar este plan." onRetry={goBack} />;
    } else {
      body = <EditPlan plan={plan} onCancel={goBack} onSaved={handlePlanUpdated} />;
    }
  }
  else if (current.screen === "chat") {
    const plan = plans.find((p) => p.id === current.planId);
    body = plan ? <ChatScreen plan={plan} onBack={goBack} onToast={showToast} /> : <LoadingBlock text="Cargando…" />;
  }
  else if (current.screen === "personProfile") {
    // Antes, si personId coincidía con una de las claves del diccionario mock
    // PEOPLE, se mostraba ese perfil inventado en vez del perfil real. Ahora
    // siempre se usa CreatorProfile, que trae los datos reales de
    // public.profiles (y sus planes/seguidores reales) desde Supabase.
    body = <CreatorProfile personId={current.personId} onBack={goBack} />;
  }

  const showNav = ["feed", "discover", "activity", "profile"].includes(current.screen) && !mapHeroActive;
  // Solo la pantalla del mapa rompe el marco de teléfono (380x680) y pasa a ocupar
  // el viewport real completo (position:fixed + inset:0, no solo el ancho de su
  // contenedor) para sentirse como una app de mapa de verdad — todas las demás
  // pantallas del V5 quedan exactamente como estaban, sin tocar nada.
  const isMapScreen = current.screen === "discover";
  // La Landing necesita centrarse verticalmente dentro de .qs-mid (ver más
  // abajo, clase .qs-landing-center) — el resto de pantallas no cambia.
  const isLanding = current.screen === "landing";
  // Detalle de plan (PlanDetail): igual que Landing, no lleva ninguna clase
  // modificadora propia (no es wide/full-bleed), así que en móvil sus esquinas
  // superiores dependían por completo de la regla base .qs-shell externa a
  // este archivo, que no define ningún radio ahí — quedaba con esquinas
  // rectas. Reutiliza la misma clase .qs-shell-rounded que ya soluciona esto
  // para Landing (mismo border-radius: 22px 22px 0 0), sin heredar el resto
  // del comportamiento de Landing (no se usa en midClassName/qs-landing-center,
  // que solo debe seguir aplicando a Landing).
  const isDetailScreen = current.screen === "detail";
  // Ajuste visual pedido para Feed/Actividad/Crear: panel con margen lateral
  // reducido, sin franja debajo antes del BottomNav, esquinas superiores
  // redondeadas. Va en una clase aparte (qs-shell-wide) y NO en .qs-shell
  // directamente porque .qs-shell es compartida con Landing/Guardados,
  // que no deben cambiar. Perfil usa una clase DISTINTA (qs-shell-full, ver
  // más abajo) porque ahí el pedido es ancho completo, sin ningún margen —
  // no el mismo margen de 12px que ya quedó bien en Feed/Actividad/Crear.
  const isWidePanelScreen = current.screen === "feed" || current.screen === "activity" || current.screen === "create";
  const isFullBleedScreen = current.screen === "profile";

  // shellStyle/midStyle: el ancho/alto de la "tarjeta" ya NO se fija en JS inline
  // (eso era lo que forzaba 380x680 sin importar el tamaño de ventana). Ahora
  // solo quedan aquí las propiedades que no cambian por breakpoint; el ancho y
  // el alto viven en las clases .qs-shell/.qs-mid de más abajo, con su @media
  // para desktop. El mapa (isMapScreen) sigue exactamente igual que antes.
  const shellStyle = isMapScreen
    ? { position: "fixed", inset: 0, margin: 0, fontFamily: FB, background: CREAM, border: "none", borderRadius: 0, overflow: "hidden", display: "flex", flexDirection: "column", zIndex: 100 }
    : { fontFamily: FB, background: CREAM, overflow: "hidden", border: `1px solid ${LINE}`, position: "relative" };
  const midStyle = isMapScreen
    ? { flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }
    : { position: "relative" };
  const shellClassName = isMapScreen ? undefined : `qs-shell${isWidePanelScreen ? " qs-shell-wide" : ""}${isFullBleedScreen ? " qs-shell-full" : ""}${(isLanding || isDetailScreen) ? " qs-shell-rounded" : ""}`;
  const midClassName = isMapScreen ? undefined : `qs-mid${isLanding ? " qs-landing-center" : ""}`;

  const shell = (
    <div style={shellStyle} className={shellClassName}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        @keyframes qsPulse { 0% { transform: scale(1); opacity: .8; } 70% { transform: scale(2.6); opacity: 0; } 100% { opacity: 0; } }

        /* Responsive del "marco" (Feed / Crear / Actividad / Perfil).
           El mapa de Descubrir no usa estas clases: sigue fullscreen vía su
           propio shellStyle (position:fixed; inset:0), sin cambios.
           Mobile: idéntico al V5 original (tarjeta de 380x680 con scroll interno).
           Desktop (>=861px): deja de comportarse como celular angosto — usa una
           columna más ancha y el scroll natural de la página en vez de la caja
           fija de 680px. */
        /* width:100% es la parte que arregla el ancho inconsistente entre
           pantallas: sin esto, al ser hijo de un flex en fila (el <main> de
           page.js), el shell se "encogía" al ancho de su contenido más angosto
           en cada pantalla (Crear/Perfil con poco contenido quedaban delgados,
           Feed con carruseles de imágenes quedaba ancho) — y la barra inferior,
           al ser hija del shell, heredaba ese ancho variable. Con width:100%
           el shell siempre ocupa su max-width completo, igual en las 4 pantallas. */
        /* Antes .qs-mid tenía su propio scroll interno (max-height + overflow-y)
           mientras .qs-shell (su padre) NO tenía altura ni overflow propios, así
           que además del scroll interno del feed, la página entera podía crecer
           y desplazarse hasta que la barra inferior (sticky, pero sin un
           contenedor con overflow del que "colgarse") quedaba a la vista: dos
           scrolls compitiendo. Ahora .qs-shell fija su alto al del teléfono
           (100dvh) y es un flex column de una sola columna: el body scrollea
           SOLO dentro de .qs-mid (flex:1) y BottomNav queda como último item,
           siempre visible al fondo, sin position:fixed ni scroll duplicado. */
        /* NAV INFERIOR: antes, en pantallas que no son el mapa, BottomNav era
           un hijo normal del flex-column (después de .qs-mid) — es decir,
           quedaba DENTRO del flujo, empujando/recortando el alto de .qs-mid
           en vez de flotar encima. Eso es lo que hacía que se comportara
           distinto entre Feed y Descubrir. Se intentó resolver con
           position:absolute anclada a .qs-mid, pero esa combinación depende
           de que .qs-shell (definida fuera de este archivo) resuelva su alto
           real de forma consistente — en producción esto hacía que la nav
           quedara más arriba del borde inferior en Feed/Landing/Perfil,
           mientras que en el mapa (que ya usa position:fixed en
           .qs-map-nav-wrap, ver abajo) sí quedaba pegada al borde real de
           pantalla. Ahora, en MÓVIL, .qs-nav-wrap también usa position:fixed
           anclada directo al viewport — la misma técnica que ya funciona en
           el mapa — así todas las pantallas comparten la misma posición
           vertical de la nav, sin depender de ningún contenedor intermedio.
           .qs-mid sigue con su padding-bottom para que el contenido real no
           quede tapado detrás de la nav.
           En DESKTOP (>=861px) se mantiene el comportamiento actual: la nav
           vuelve a quedar en flujo normal al final del contenido, sin overlay
           ni scroll de página distinto al de siempre — el mapa es la única
           excepción, porque en desktop también es fullscreen a propósito. */
        .qs-nav-wrap { position: fixed; left: 0; right: 0; bottom: 0; z-index: 1400; }
        /* Barra inferior específica de la pantalla de mapa (móvil): usa el
           mismo position:fixed que .qs-nav-wrap arriba, anclada directo al
           viewport (no a ningún contenedor flex intermedio). El fondo
           sólido y el padding de safe-area-inset-bottom ya están en el
           propio BottomNav (sin cambios ahí). */
        .qs-map-nav-wrap { position: fixed; left: 0; right: 0; bottom: 0; z-index: 1400; }
        .qs-mid { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; padding-bottom: 84px; }
        /* Solo para Landing: la convierte en un flex-column de un solo hijo
           (el div que devuelve Landing()) con justify-content:center, así el
           bloque texto+botones(+vitrina) queda centrado verticalmente dentro
           del alto REAL ya disponible de .qs-mid (que ya descuenta el espacio
           de la nav flotante vía su padding-bottom) — sin que Landing tenga
           que declarar ningún height/minHeight en porcentaje. Esto evita el
           problema anterior: un height:"100%" en un hijo, dentro de una
           cadena de contenedores con flex-grow + overflow:auto, no siempre
           resuelve el porcentaje de forma consistente entre navegadores (por
           eso el resultado quedaba pegado arriba pese al justifyContent en
           el propio Landing). Centrar desde el PADRE con altura ya resuelta
           (.qs-mid) es la forma robusta de conseguirlo. */
        /* min-height:100dvh (además de justify-content:center) es el mismo
           respaldo que ya existía solo para desktop más abajo: así el
           centrado de Landing no depende de que .qs-shell (definida fuera
           de este archivo) resuelva su alto de forma consistente en todos
           los navegadores — con este mínimo garantizado, el bloque queda
           centrado de verdad también en móvil. */
        .qs-landing-center { display: flex; flex-direction: column; justify-content: center; min-height: 100dvh; }
        /* Panel de Feed/Actividad/Crear en MÓVIL (clase qs-shell-wide, ver
           arriba): antes tenía un margen de 12px a cada lado, que dejaba el
           panel (y su barra inferior, que desde el cambio anterior comparte
           esta misma clase) más angosto que Descubrir/Perfil. Ahora usa el
           mismo truco "full bleed" que ya usa .qs-shell-full más abajo
           (width:100vw + margin izq/der negativo con calc(50% - 50vw)) para
           llegar exactamente al mismo ancho que esas dos pantallas — solo se
           mantiene el border-radius superior y el display:flex que Feed/
           Actividad necesitan para su layout interno (header + scroll + nav).
           No toca Landing ni Guardados porque esas pantallas no llevan esta
           clase. */
        @media (max-width: 860px) {
          .qs-shell.qs-shell-wide { width: 100vw; margin: 0 calc(50% - 50vw); max-width: none; flex: 1 1 auto; height: 100dvh; border-radius: 22px 22px 0 0; display: flex; flex-direction: column; }
          /* Se probó una clase .qs-nav-wrap-inset con left/right:12px acá, pero
             asumía que position:fixed en .qs-nav-wrap se resuelve contra el
             viewport real — igual que .qs-shell-wide definía su margen de
             12px en ese momento. Si en realidad se resuelve contra otro
             contenedor (algo fuera de este archivo, ver comentario junto a
             .qs-nav-wrap más arriba), ese inset se sumaba al margen del panel
             en vez de igualarlo, empeorando el desalineado. Se reemplazó por
             el mismo truco ya usado en el mapa: envolver la nav en un
             .qs-shell real, así hereda el ancho/posición EXACTOS del panel
             sin depender de esa suposición — ver el render de la nav más
             abajo en este archivo. */
          /* Perfil (clase qs-shell-full): a diferencia de Feed/Actividad,
             acá el pedido es ancho completo y SIN margen en ningún lado —
             ni lateral ni superior. El panel tiene position:relative (fijado
             por estilo inline, que siempre gana sobre esta clase), así que
             left/right/top NO sirven para estirarlo de borde a borde —solo
             lo desplazarían dentro de su posición normal—. Lo que sí
             funciona con position:relative es el truco estándar de "full
             bleed": width:100vw + margin izquierdo/derecho negativo
             (calc(50% - 50vw)), que rompe cualquier margen/padding del
             padre y lo estira al viewport real sin depender de ese CSS
             externo. margin-top queda en 0 en el mismo shorthand. Abajo
             sigue en 0 (pegado a la barra, ya fija). Solo las esquinas
             superiores quedan redondeadas. */
          .qs-shell.qs-shell-full { width: 100vw; margin: 0 calc(50% - 50vw); height: 100dvh; border-radius: 22px 22px 0 0; }
          /* Landing (clase qs-shell-rounded): a diferencia de Feed/Actividad/
             Perfil, acá SOLO se toca border-radius — nada de margin, width
             ni height, porque el centrado de Landing ya funciona bien (vía
             .qs-landing-center) y no hay que tocarlo. La causa de las
             esquinas puntiagudas: shellStyle (inline, en este mismo
             archivo) nunca define borderRadius para pantallas sin mapa, así
             que en móvil ese valor depende por completo de la regla base
             .qs-shell externa a este archivo — que aquí no se ve que defina
             ningún radio para mobile (solo el media query de desktop, más
             abajo, sí lo hace). Como Landing es la única pantalla sin mapa
             que no lleva ninguna clase modificadora propia, se quedaba sin
             ese redondeo. Esta regla mínima soluciona solo eso. */
          .qs-shell.qs-shell-rounded { border-radius: 22px 22px 0 0; }
        }
        @media (min-width: 861px) {
          .qs-shell { max-width: 640px; border-radius: 20px; height: auto; max-height: none; display: block; }
          .qs-mid { flex: none; overflow-y: visible; overflow-x: visible; padding-bottom: 0; }
          .qs-nav-wrap { position: static; z-index: auto; }
          /* Mismo comportamiento de escritorio que .qs-nav-wrap: en laptop
             el mapa ya es fullscreen "a propósito" (ver comentario arriba),
             y la barra vuelve a su posición estática de siempre — no cambia
             nada del comportamiento actual en desktop. */
          .qs-map-nav-wrap { position: static; z-index: auto; }
          /* En desktop .qs-mid deja de tener alto propio (flex:none), así que
             el centrado de la Landing necesita un alto de referencia propio:
             el del viewport menos el margen del marco. Sin esto, la portada
             quedaba pegada arriba en laptop. El resto de pantallas no usa
             esta clase, así que nada más cambia. */
          .qs-landing-center { display: flex; flex-direction: column; justify-content: center; min-height: calc(100dvh - 96px); }
        }
      `}</style>
      <Toast text={toast} />
      <div style={midStyle} className={midClassName}>
        {body}
        {shareState && <ShareSheet plan={shareState.plan} mode={shareState.mode} onClose={() => setShareState(null)} onToast={(t) => showToast(t)} />}
        {commentsState && <CommentsSheet plan={commentsState.plan} onClose={() => setCommentsState(null)} onToast={(t) => showToast(t)} onCommentPosted={bumpCommentCount} />}
        {/* La nav vive DENTRO del contenedor de contenido para poder flotar sobre
            él en móvil. Antes, para Feed/Actividad/Perfil, se asumía que
            .qs-nav-wrap (position:fixed) ya "heredaba" el ancho del panel por
            estar anidada dentro de .qs-mid/.qs-shell — pero position:fixed se
            calcula contra su containing block real (el viewport, o un
            ancestro con transform si lo hay fuera de este archivo), NO contra
            el ancho visual del padre en el árbol. Esa suposición era la causa
            de que la barra quedara desalineada del panel en Feed. La solución
            ya existía para el mapa (ver .qs-map-nav-wrap): envolver la nav en
            un .qs-shell real, con las MISMAS clases modificadoras que usa el
            panel de esa pantalla (qs-shell-wide para Feed/Actividad,
            qs-shell-full para Perfil), para que herede exactamente su mismo
            ancho/margen/posición sin depender de esa suposición. Se
            sobreescriben height/maxHeight/display inline (igual que en el
            mapa) para que el envoltorio no intente tomar el alto completo del
            panel — solo su ancho y posición horizontal. BottomNav en sí no
            cambia: solo cambia el contenedor que la envuelve. */}
        {showNav && (
          isMapScreen ? (
            <div className="qs-map-nav-wrap">
              <div className="qs-shell" style={{ height: "auto", maxHeight: "none", display: "block" }}>
                <BottomNav current={current.screen} onNav={navBottom} />
              </div>
            </div>
          ) : (
            <div className="qs-nav-wrap">
              <div className={shellClassName} style={{ height: "auto", maxHeight: "none", display: "block", border: "none" }}>
                <BottomNav current={current.screen} onNav={navBottom} />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );

  // La pantalla de mapa se renderiza directamente en document.body en vez de en su
  // lugar normal dentro del árbol de React. Es lo que de verdad garantiza el
  // fullscreen: si algún contenedor padre (en layout.jsx/page.jsx, que no vemos
  // desde acá) tiene un transform, overflow o filter aplicado, "position:fixed"
  // deja de ser relativo a la ventana del navegador y pasa a serlo a ESE padre —
  // eso es lo que hacía que el buscador/chips/tarjeta quedaran fuera de la parte
  // visible hasta reducir el zoom. El portal evita depender de eso por completo.
  // Las demás pantallas (Feed, Crear, Actividad, Perfil) NO usan portal y siguen
  // renderizándose exactamente igual que siempre, en su lugar normal.
  if (isMapScreen && typeof document !== "undefined") {
    return createPortal(shell, document.body);
  }
  return shell;
}
