"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, X, Users, MapPin, Clock, Send, Bookmark, LocateFixed } from "lucide-react";
import { CAT_COLORS, CATEGORIES, CAT_EMOJI } from "../lib/categories";
import { INK, BRAND, BRAND_DARK, BRAND_BG, LIVE, MUTED, LINE, FD, FB } from "../lib/theme";

// Centro por defecto del mapa (Lima, Perú — la app ya asume esta zona horaria/ciudad
// en el resto del código). Solo se usa mientras no hay ningún plan con pin todavía.
const LIMA_CENTER = [-12.0464, -77.0428];

// Capa base del mapa: OpenStreetMap estándar. Confirmado en pruebas
// anteriores que carga correctamente (calles, colores, etiquetas) sin
// necesidad de ninguna key ni configuración adicional.
// Color de fondo del lienzo mientras cargan los tiles.
const MAP_BG = "#FAFAF8";

const floatBtnStyle = {
  width: 40, height: 40, borderRadius: 13, border: "none", background: "rgba(255,255,255,0.9)",
  boxShadow: "0 6px 16px rgba(22,21,32,.18)", fontFamily: FD, fontWeight: 700, fontSize: 18,
  color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
};

// Marker moderno: círculo colorido por categoría con el emoji centrado, borde blanco
// y sombra — reemplaza el pin clásico en forma de gota. Al estar activo, crece un
// poco y suma un aro suave alrededor (además del halo de pulso si el plan es "en vivo").
function pinDivIcon(category, live, active) {
  const color = CAT_COLORS[category] || BRAND;
  const emoji = CAT_EMOJI[category] || "📍";
  const size = active ? 46 : 36;
  const tail = Math.round(size * 0.22);
  const html = `
    <div style="position:relative;width:${size}px;height:${size + tail}px;display:flex;flex-direction:column;align-items:center;">
      ${live ? `<span style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:${size + 14}px;height:${size + 14}px;margin-top:-7px;margin-left:-7px;border-radius:50%;background:${LIVE}4D;animation:qsPulse 1.6s infinite;"></span>` : ""}
      ${active ? `<span style="position:absolute;top:-5px;left:50%;transform:translateX(-50%);width:${size + 10}px;height:${size + 10}px;border-radius:50%;border:2px solid ${color};opacity:.5;"></span>` : ""}
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:0 6px 16px rgba(22,21,32,.4), 0 0 0 3px white;display:flex;align-items:center;justify-content:center;animation:qsPinPop .22s cubic-bezier(.34,1.56,.64,1);">
        <span style="font-size:${Math.round(size * 0.48)}px;line-height:1;">${emoji}</span>
      </div>
      <span style="width:0;height:0;border-left:${tail / 1.6}px solid transparent;border-right:${tail / 1.6}px solid transparent;border-top:${tail}px solid ${color};margin-top:-3px;filter:drop-shadow(0 2px 2px rgba(22,21,32,.25));"></span>
    </div>`;
  // El ancla queda en la punta de la cola (abajo), como un pin de mapa real
  // clavado en el punto exacto, no flotando centrado sobre él.
  return L.divIcon({ html, className: "qs-pin", iconSize: [size, size + tail], iconAnchor: [size / 2, size + tail] });
}

// Única fuente de verdad para el estado del botón de unirse — misma lógica que
// joinButtonInfo() en QueSaleApp.jsx (duplicada acá porque este archivo no
// importa nada de allá, para no crear una dependencia cruzada nueva).
function joinButtonInfo(plan, joined, reqStatus) {
  if (joined) return { label: "✓ Apuntado", kind: "leave" };
  if (plan.joinPolicy === "approval") {
    if (reqStatus === "pending") return { label: "Solicitud enviada", kind: "cancel" };
    if (reqStatus === "rejected") return { label: "Solicitud rechazada", kind: "rejected" };
    return { label: "Solicitar unirme", kind: "request" };
  }
  return { label: "Me apunto", kind: "join" };
}

export default function DiscoverMap({ plans, joinedIds, savedIds, requestStatusByPlan = {}, onJoin, onSave, onRequestJoin, onCancelRequest, onShareOpen, onChat, onProfile, filter, setFilter, onHeroToggle }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [hero, setHero] = useState(null); // { plan, rect } — plan en vista inmersiva
  const containerRef = useRef(null);
  const cardRef = useRef(null);
  const mapRef = useRef(null);

  // Sin datos falsos: solo entran al mapa los planes reales de Supabase que ya
  // tienen coordenadas. Los que no las tienen (planes creados antes de esta función,
  // o sin permiso de ubicación) siguen existiendo normalmente en Feed/Mis planes,
  // simplemente no aparecen como pin aquí.
  const withCoords = useMemo(() => plans.filter((p) => typeof p.lat === "number" && typeof p.lng === "number"), [plans]);
  const byFilter = filter === "Todos" ? withCoords : withCoords.filter((p) => p.category === filter);
  const q = query.trim().toLowerCase();
  const shown = q
    ? byFilter.filter((p) => p.title.toLowerCase().includes(q) || p.location.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    : byFilter;

  const selected = shown.find((p) => p.id === selectedId) || null;

  // Si el plan seleccionado deja de estar en la lista (cambio de filtro, búsqueda,
  // o el plan fue cancelado por su creador), no dejamos una tarjeta flotante huérfana.
  useEffect(() => {
    if (selectedId && !shown.some((p) => p.id === selectedId)) setSelectedId(null);
  }, [shown, selectedId]);

  // Recentra el mapa suavemente en el plan seleccionado, sin desmontar/remontar nada.
  useEffect(() => {
    if (selected && mapRef.current) {
      mapRef.current.flyTo([selected.lat, selected.lng], Math.max(mapRef.current.getZoom(), 15), { duration: 0.6 });
    }
  }, [selected]);

  // "Botón circular para ubicación actual": solo mueve la cámara del mapa, no toca
  // filtros ni datos. Si el usuario no da permiso, fallamos en silencio (no rompe nada).
  const locateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 15, { duration: 0.8 }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const openHero = (plan, el) => {
    if (!el || !containerRef.current) return;
    const rect = el.getBoundingClientRect();
    const parentRect = containerRef.current.getBoundingClientRect();
    setHero({
      plan,
      rect: { top: rect.top - parentRect.top, left: rect.left - parentRect.left, width: rect.width, height: rect.height },
    });
    onHeroToggle?.(true);
  };
  const closeHero = () => {
    setHero(null);
    onHeroToggle?.(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", zIndex: 0, height: "100%", width: "100%", background: MAP_BG, overflow: "hidden" }}>
      <MapContainer ref={mapRef} center={LIMA_CENTER} zoom={12} zoomControl={false} attributionControl={false} style={{ width: "100%", height: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains="abc"
          maxZoom={19}
        />
        {shown.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinDivIcon(p.category, p.live, p.id === selectedId)}
            eventHandlers={{ click: () => setSelectedId(p.id) }}
          />
        ))}
      </MapContainer>

      {/* Controles flotantes: zoom + "mi ubicación", recolocados para no chocar con
          la tarjeta del plan seleccionado (se ocultan mientras esa tarjeta está abierta). */}
      {/* bottom:92 en vez de 14: deja espacio para la barra de navegación
          inferior, que ahora flota superpuesta sobre el mapa (capa aparte,
          ver AppShell) en vez de empujarlo hacia arriba. Sin este espacio los
          controles quedarían tapados detrás de la nav. */}
      {!selected && (
        <div style={{ position: "absolute", right: 14, bottom: 92, zIndex: 1002, display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => mapRef.current?.zoomIn()} style={floatBtnStyle} aria-label="Acercar">+</button>
          <button onClick={() => mapRef.current?.zoomOut()} style={floatBtnStyle} aria-label="Alejar">−</button>
        </div>
      )}

      {/* Frase principal + buscador + chips, flotando sobre el mapa con un degradado
          sutil detrás para que el texto tenga contraste y se sienta parte del mapa,
          no una barra genérica pegada encima. */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 1005,
          padding: "18px 14px 16px",
          background: "linear-gradient(180deg, rgba(22,21,32,.5) 0%, rgba(22,21,32,.14) 62%, rgba(22,21,32,0) 100%)",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 19, color: "white", margin: "0 0 12px", letterSpacing: -0.2, textShadow: "0 2px 10px rgba(0,0,0,.35)" }}>
            Encuentra tu próximo plan
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                flex: 1, display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                borderRadius: 18, padding: "11px 14px", boxShadow: "0 8px 22px rgba(22,21,32,.22)",
              }}
            >
              <Search size={17} color={MUTED} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="¿Qué quieres hacer?"
                style={{ border: "none", outline: "none", fontFamily: FB, fontSize: 13.5, color: INK, flex: 1, background: "transparent", minWidth: 0 }}
              />
              {query && (
                <button onClick={() => setQuery("")} style={{ border: "none", background: LINE, borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <X size={12} color={INK} />
                </button>
              )}
            </div>
            <button
              onClick={locateMe}
              aria-label="Mi ubicación actual"
              style={{
                width: 44, height: 44, borderRadius: "50%", border: "none", flexShrink: 0,
                background: "rgba(255,255,255,0.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                boxShadow: "0 8px 22px rgba(22,21,32,.22)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <LocateFixed size={18} color={BRAND_DARK} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 10, paddingBottom: 2 }}>
            {CATEGORIES.map((c) => {
              const active = filter === c;
              const chipColor = c === "Todos" ? INK : (CAT_COLORS[c] || BRAND);
              const emoji = c === "Todos" ? null : CAT_EMOJI[c];
              return (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  style={{
                    whiteSpace: "nowrap", fontSize: 12.5, fontFamily: FB, fontWeight: 700, padding: "7px 13px",
                    borderRadius: 20, border: active ? "none" : `1.5px solid rgba(255,255,255,0.6)`, cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", gap: 5,
                    background: active ? chipColor : "rgba(255,255,255,0.85)",
                    color: active ? "white" : INK,
                    boxShadow: active ? `0 5px 14px ${chipColor}66` : "0 3px 10px rgba(22,21,32,.12)",
                    transition: "transform .12s ease, box-shadow .12s ease",
                  }}
                >
                  {emoji && <span>{emoji}</span>}{c}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Estado vacío: sin planes con ubicación, o sin resultados para el filtro/búsqueda actual */}
      {shown.length === 0 && (
        <div style={{ position: "absolute", top: "42%", left: 24, right: 24, maxWidth: 420, margin: "0 auto", textAlign: "center", zIndex: 1003, pointerEvents: "none" }}>
          <div style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)", borderRadius: 20, padding: "18px 16px", boxShadow: "0 10px 26px rgba(22,21,32,.16)" }}>
            <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 14.5, color: INK, margin: "0 0 4px" }}>
              {withCoords.length === 0 ? "Todavía no hay planes con ubicación" : "Sin planes para esta búsqueda"}
            </p>
            <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: 0 }}>
              {withCoords.length === 0 ? "Los planes nuevos aparecerán aquí como pines 📍" : "Prueba con otra categoría o busca algo distinto"}
            </p>
          </div>
        </div>
      )}

      {/* Tarjeta flotante tipo bottom-sheet del plan seleccionado (toca un pin para verla) */}
      {selected && !hero && (() => {
        const cardInfo = joinButtonInfo(selected, joinedIds.has(selected.id), requestStatusByPlan[selected.id]);
        const cardCtaAction = (e) => {
          e.stopPropagation();
          if (cardInfo.kind === "rejected") return;
          if (cardInfo.kind === "leave" || cardInfo.kind === "join") onJoin(selected.id);
          else if (cardInfo.kind === "request") onRequestJoin?.(selected.id);
          else if (cardInfo.kind === "cancel") onCancelRequest?.(selected.id);
        };
        return (
        <div style={{ position: "absolute", left: 14, right: 14, bottom: 92, maxWidth: 420, margin: "0 auto", zIndex: 1010, animation: "qsCardUp .25s cubic-bezier(.2,.8,.2,1)" }}>
          <div
            ref={cardRef}
            onClick={(e) => openHero(selected, cardRef.current || e.currentTarget)}
            style={{ position: "relative", background: "white", borderRadius: 26, overflow: "hidden", boxShadow: "0 16px 36px rgba(22,21,32,.28)", cursor: "pointer" }}
          >
            {/* Foto protagonista: banner grande arriba de la tarjeta, no una miniatura al costado */}
            <div style={{ position: "relative", height: 132, background: selected.photoUrl ? `#eee url(${selected.photoUrl}) center/cover no-repeat` : `${CAT_COLORS[selected.category] || BRAND}22` }}>
              {!selected.photoUrl && (
                <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
                  {CAT_EMOJI[selected.category] || "📍"}
                </span>
              )}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.05) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,.35) 100%)" }} />
              {/* "Manija" de bottom sheet, sobre la foto */}
              <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 34, height: 4, borderRadius: 4, background: "rgba(255,255,255,.75)" }} />
              <span style={{ position: "absolute", top: 14, left: 14, display: "inline-flex", alignItems: "center", gap: 4, fontFamily: FB, fontWeight: 700, fontSize: 10.5, color: "white", background: CAT_COLORS[selected.category] || BRAND, padding: "4px 10px", borderRadius: 20 }}>
                {CAT_EMOJI[selected.category] || "📍"} {selected.category}
              </span>
              {selected.live && (
                <span style={{ position: "absolute", top: 14, right: 14, display: "inline-flex", alignItems: "center", gap: 4, fontFamily: FB, fontWeight: 700, fontSize: 10, color: LIVE, background: "rgba(255,255,255,.92)", padding: "4px 9px", borderRadius: 20 }}>
                  ● AHORA
                </span>
              )}
              <p style={{ position: "absolute", left: 14, right: 14, bottom: 8, fontFamily: FD, fontWeight: 700, fontSize: 16.5, color: "white", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selected.title}
              </p>
            </div>

            <div style={{ padding: "12px 14px 14px" }}>
              <p style={{ fontFamily: FB, fontSize: 12, color: MUTED, margin: "0 0 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={11} /> {selected.location} · {selected.time}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: FB, fontSize: 11.5, color: MUTED, display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <Users size={11} /> {selected.joined + (joinedIds.has(selected.id) ? 1 : 0)}/{selected.capacity}
                </span>
                <button
                  onClick={cardCtaAction}
                  disabled={cardInfo.kind === "rejected"}
                  style={{ flex: 1, border: "none", borderRadius: 14, padding: "11px 15px", fontFamily: FB, fontWeight: 700, fontSize: 12.5, cursor: cardInfo.kind === "rejected" ? "default" : "pointer", background: cardInfo.kind === "leave" || cardInfo.kind === "cancel" ? BRAND_BG : cardInfo.kind === "rejected" ? LINE : BRAND, color: cardInfo.kind === "leave" || cardInfo.kind === "cancel" ? BRAND_DARK : cardInfo.kind === "rejected" ? MUTED : "white" }}
                >
                  {cardInfo.label}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {hero && (
        <PlanHero
          plan={hero.plan}
          origin={hero.rect}
          joined={joinedIds.has(hero.plan.id)}
          saved={savedIds.has(hero.plan.id)}
          reqStatus={requestStatusByPlan[hero.plan.id]}
          onClose={closeHero}
          onJoin={onJoin}
          onSave={onSave}
          onRequestJoin={onRequestJoin}
          onCancelRequest={onCancelRequest}
          onShareOpen={onShareOpen}
          onChat={onChat}
          onProfile={onProfile}
        />
      )}

      <style>{`
        @keyframes qsCardUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes qsPinPop { 0% { transform: scale(0.6); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
        @keyframes qsPulse { 0% { transform: scale(1); opacity: .8; } 70% { transform: scale(2.4); opacity: 0; } 100% { opacity: 0; } }
        .leaflet-container { font-family: ${FB}; background: ${MAP_BG}; }
        .qs-pin { transition: filter .15s ease; }
        .qs-pin:hover { filter: brightness(1.06); }
      `}</style>

      {/* Atribución obligatoria de los tiles (OpenStreetMap) */}
      <p style={{ position: "absolute", right: 6, bottom: 2, zIndex: 1001, margin: 0, fontFamily: FB, fontSize: 8.5, color: "rgba(22,21,32,.35)", pointerEvents: "none" }}>
        © OpenStreetMap contributors
      </p>
    </div>
  );
}

// La vista inmersiva: el pin/tarjeta "se convierte" en esto. Arranca con el tamaño y
// posición exactos de la tarjeta/miniatura que se tocó (via `origin`) y en el siguiente
// frame anima hacia pantalla completa — el efecto de "elemento compartido" sin
// necesidad de ninguna librería de animación nueva.
function PlanHero({ plan, origin, joined, saved, reqStatus, onClose, onJoin, onSave, onRequestJoin, onCancelRequest, onShareOpen, onChat, onProfile }) {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = plan.joined + (joined ? 1 : 0);
  const missing = Math.max(0, plan.capacity - total);
  const complete = total >= plan.capacity;
  const info = joinButtonInfo(plan, joined, reqStatus);
  const ctaDisabled = (complete && info.kind !== "leave") || info.kind === "rejected";
  const ctaAction = () => {
    if (ctaDisabled) return;
    if (info.kind === "leave" || info.kind === "join") onJoin(plan.id);
    else if (info.kind === "request") onRequestJoin?.(plan.id);
    else if (info.kind === "cancel") onCancelRequest?.(plan.id);
  };

  const frameStyle = grown
    ? { top: 0, left: 0, width: "100%", height: "100%", borderRadius: 0 }
    : { top: origin.top, left: origin.left, width: origin.width, height: origin.height, borderRadius: 18 };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 2000 }}>
      <div
        style={{
          position: "absolute",
          ...frameStyle,
          overflow: "hidden",
          background: plan.photoUrl ? `#111 url(${plan.photoUrl}) center/cover no-repeat` : `${CAT_COLORS[plan.category] || BRAND}`,
          boxShadow: "0 20px 44px rgba(0,0,0,.35)",
          transition: "top .38s cubic-bezier(.2,.8,.2,1), left .38s cubic-bezier(.2,.8,.2,1), width .38s cubic-bezier(.2,.8,.2,1), height .38s cubic-bezier(.2,.8,.2,1), border-radius .38s ease",
        }}
      >
        {/* Emoji de categoría como watermark de fondo cuando no hay foto — mismo
            tratamiento visual (CAT_COLORS + CAT_EMOJI) que el resto de la app. */}
        {!plan.photoUrl && (
          <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 140, opacity: 0.22, pointerEvents: "none" }}>
            {CAT_EMOJI[plan.category] || "📍"}
          </span>
        )}
        {/* Degradado para que el texto blanco de abajo/arriba siempre tenga contraste */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 52%, rgba(0,0,0,.8) 100%)", opacity: grown ? 1 : 0, transition: "opacity .3s ease .15s" }} />

        <button onClick={onClose} aria-label="Cerrar" style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: grown ? 1 : 0, transition: "opacity .25s ease .1s" }}>
          <X size={18} color="white" />
        </button>
        <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8, opacity: grown ? 1 : 0, transition: "opacity .25s ease .1s" }}>
          <button onClick={() => onSave(plan.id)} aria-label="Guardar" style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Bookmark size={16} color="white" fill={saved ? "white" : "none"} />
          </button>
          <button onClick={() => onShareOpen(plan)} aria-label="Compartir" style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Send size={16} color="white" />
          </button>
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 20px 22px", opacity: grown ? 1 : 0, transform: grown ? "translateY(0)" : "translateY(10px)", transition: "opacity .3s ease .18s, transform .3s ease .18s" }}>
          <span style={{ display: "inline-block", fontFamily: FB, fontWeight: 700, fontSize: 11, color: "white", background: `${CAT_COLORS[plan.category] || BRAND}CC`, padding: "5px 11px", borderRadius: 20, marginBottom: 10 }}>
            {CAT_EMOJI[plan.category] || "📍"} {plan.category}
          </span>
          <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 23, color: "white", margin: "0 0 8px", textShadow: "0 2px 10px rgba(0,0,0,.4)" }}>{plan.title}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
            <p style={{ fontFamily: FB, fontSize: 13, color: "rgba(255,255,255,.92)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}><Clock size={13} /> {plan.time}</p>
            <p style={{ fontFamily: FB, fontSize: 13, color: "rgba(255,255,255,.92)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}><MapPin size={13} /> {plan.location}</p>
            <button onClick={() => onProfile(plan.creator)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: FB, fontSize: 13, color: "rgba(255,255,255,.92)" }}>
              {plan.creatorAvatarUrl ? (
                <img src={plan.creatorAvatarUrl} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: BRAND, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: "white" }}>{plan.creatorInitial}</span>
              )}
              Creado por {plan.creatorName}
            </button>
            <p style={{ fontFamily: FB, fontSize: 13, color: "rgba(255,255,255,.92)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}><Users size={13} /> {total}/{plan.capacity} apuntados</p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={ctaAction}
              disabled={ctaDisabled}
              style={{
                flex: 1, border: "none", borderRadius: 16, padding: 15, fontFamily: FB, fontWeight: 700, fontSize: 14.5,
                cursor: ctaDisabled ? "default" : "pointer",
                background: info.kind === "leave" || info.kind === "cancel" ? "rgba(255,255,255,.22)" : complete ? "rgba(255,255,255,.3)" : "white",
                color: info.kind === "leave" || info.kind === "cancel" ? "white" : complete ? "rgba(255,255,255,.7)" : INK,
              }}
            >
              {complete && info.kind !== "leave" ? "Plan completo" : info.kind === "leave" ? "✓ Apuntado" : info.kind === "join" ? `Me apunto${missing > 0 ? ` · faltan ${missing}` : ""}` : info.label}
            </button>
            {joined && (
              <button onClick={() => onChat(plan.id)} aria-label="Ver chat" style={{ border: "none", borderRadius: 16, padding: "0 18px", background: "white", color: INK, fontFamily: FB, fontWeight: 700, fontSize: 18, cursor: "pointer" }}>
                💬
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
