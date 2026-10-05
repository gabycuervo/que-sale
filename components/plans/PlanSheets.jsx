import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React, { useState, useEffect, useCallback } from "react";
import { Home, Search, Plus, Bell, User, ChevronLeft, Clock, Send, Bookmark, Check, Users, Dice5, Star, X, Share2, UserPlus, MessageCircle, Link2, Instagram, Heart, UserCheck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import { relativeTimeFromNow } from "../../lib/planUtils";
import { Avatar } from "../ui/AppPrimitives";

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

export { ShareSheet, CommentsSheet };
