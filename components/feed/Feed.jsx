import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React, { useState } from "react";
import { X, MapPin, Bookmark, User, Dice5 } from "lucide-react";
import { CATEGORIES, CAT_COLORS, CAT_EMOJI } from "../../lib/categories";
import { STORIES, QUICK_CATS, WHEN_OPTIONS } from "../../lib/planConstants";
import { PlanCard } from "../plans/PlanCard";
import { CategoryChips, StoriesRow, TimeTabs, LoadingBlock, ErrorBlock } from "../ui/AppPrimitives";
import { reasonFor } from "../../lib/planUtils";
import { useAuth } from "../../lib/AuthContext";
import { Avatar, LiveDot, TopBar } from "../ui/AppPrimitives";

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

export { Surprise, Feed, Discover, Saved };
