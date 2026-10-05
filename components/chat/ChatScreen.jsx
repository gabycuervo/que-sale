import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React, { useEffect, useRef, useState } from "react";
import { Send, ChevronLeft } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import { Avatar } from "../ui/AppPrimitives";

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

export { ChatScreen };
