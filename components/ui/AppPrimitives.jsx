import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";

function Avatar({ color, initial, size = 28, ring = true, photo, avatarUrl }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: ring ? "2px solid white" : "none", flexShrink: 0 }} />;
  }
  if (photo) {
    return <img src={photo} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: ring ? "2px solid white" : "none", flexShrink: 0 }} />;
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
export default

export { Avatar, LiveDot, CategoryChips, StoriesRow, TimeTabs, BottomNav, ChoiceCard, TopBar, Toast, LoadingBlock, ErrorBlock };
