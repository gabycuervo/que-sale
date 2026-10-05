import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React from "react";
import { Home, Search, Plus, Bell, User, ChevronLeft, Clock, Send, Bookmark, Check, Users, Dice5, Star, X, Share2, UserPlus, MessageCircle, Link2, Instagram, Heart, UserCheck } from "lucide-react";
import { CAT_COLORS, CAT_EMOJI } from "../../lib/categories";
import { formatPlanWhen, planImage, planCardBg } from "../../lib/planUtils";
import { Avatar, LiveDot } from "../ui/AppPrimitives";

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

export { PlanCard };
