import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React, { useState } from "react";
import { Home, Search, Plus, Bell, User, ChevronLeft, Clock, Send, Bookmark, Check, Users, Dice5, Star, X, Share2, UserPlus, MessageCircle, Link2, Instagram, Heart, UserCheck, MapPin } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import { Avatar, TopBar } from "../ui/AppPrimitives";
import { PlanCard } from "../plans/PlanCard";
import { CAT_COLORS, CAT_EMOJI } from "../../lib/categories";

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

export { Profile };
