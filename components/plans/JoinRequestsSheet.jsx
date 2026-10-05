import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React, { useCallback, useEffect, useState } from "react";
import { Home, Search, Plus, Bell, User, ChevronLeft, Clock, Send, Bookmark, Check, Users, Dice5, Star, X, Share2, UserPlus, MessageCircle, Link2, Instagram, Heart, UserCheck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import { Avatar } from "../ui/AppPrimitives";

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

export { JoinRequestsSheet };
