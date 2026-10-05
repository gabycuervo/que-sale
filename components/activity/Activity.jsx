import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React, { useEffect, useState } from "react";
import { Home, Search, Plus, Bell, User, ChevronLeft, Clock, Send, Bookmark, Check, Users, Dice5, Star, X, Share2, UserPlus, MessageCircle, Link2, Instagram, Heart, UserCheck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import { Avatar, LoadingBlock } from "../ui/AppPrimitives";

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

export { Activity };
