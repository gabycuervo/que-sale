import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Home, Search, Plus, Bell, User, ChevronLeft, Clock, Send, Bookmark, Check, Users, Dice5, Star, X, Share2, UserPlus, MessageCircle, Link2, Instagram, Heart, UserCheck } from "lucide-react";
import { CAT_COLORS, CAT_EMOJI } from "../../lib/categories";
import { formatPlanWhen, planImage, planCardBg } from "../../lib/planUtils";
import { Avatar, LiveDot, TopBar } from "../ui/AppPrimitives";
import { ShareSheet, CommentsSheet } from "./PlanSheets";
import { JoinRequestsSheet } from "./JoinRequestsSheet";

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

export { PlanDetail };
