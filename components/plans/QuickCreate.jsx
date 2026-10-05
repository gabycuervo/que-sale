import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React, { useEffect, useMemo, useState } from "react";
import { Clock, Users, MapPin, X } from "lucide-react";
import { CAT_COLORS, CAT_EMOJI } from "../../lib/categories";
import { QUICK_CATS, CREATE_CATS, WHEN_OPTIONS, BOOST_OPTIONS } from "../../lib/planConstants";
import { ChoiceCard, TopBar } from "../ui/AppPrimitives";
import { getCurrentCoords } from "../../lib/planUtils";
import LocationPicker from "../LocationPicker";

function QuickCreate({ onPublish, onCancel, publishing, publishError }) {
  const TOTAL_STEPS = 3;
  const [step, setStep] = useState(1);
  // Antes acá había un valor fijo ("Miraflores, Lima") que se guardaba tal cual en
  // location_name si la persona no lo cambiaba a mano — sin relación real con dónde
  // se hace el plan ni con las coordenadas GPS reales que sí se piden más abajo
  // (ver handlePublish/getCurrentCoords en AppShell). Ahora arranca vacío: la
  // persona escribe el lugar real, y el paso 3 no deja publicar sin ese texto.
  const [draft, setDraft] = useState({ cat: null, when: null, mode: null, count: null, location: "", boost: null, joinPolicy: "open", coords: null, coordsSource: null });
  // (Antes acá había un estado "editLoc" que alternaba entre mostrar un <p> con
  // "Cambiar" o el <input> de ubicación, según "!editLoc && draft.location.trim()".
  // Como draft.location nunca se precarga (ver comentario de arriba: ya no hay
  // ningún valor por defecto tipo "Miraflores, Lima"), esa condición se volvía
  // true apenas la persona escribía UNA letra — React desmontaba el <input> y
  // montaba el <p> en su lugar, así que el navegador cerraba el teclado en cada
  // tecla. No era un problema de foco: era un cambio de tipo de nodo en cada
  // render. Se quita ese estado y esa rama muerta por completo; el campo de
  // ubicación ahora es siempre el mismo <input>, nunca se remonta.)
  // (Antes acá había un estado "locationRequested" que solo cambiaba el texto/
  // habilitado del botón de publicar. Ya no hace falta: ahora ese botón depende
  // directamente de si ya existe draft.coords, ver más abajo.)
  // Texto libre cuando la persona elige "＋ Otro" en el paso 1 (ver CREATE_CATS).
  // Se guarda aparte del draft.cat mientras escribe, y solo se vuelca a la
  // categoría real (resolvedCat, más abajo) al avanzar/publicar — así el campo
  // puede quedar vacío mientras la persona todavía está escribiendo sin que
  // eso rompa la vista previa del paso 3.
  const [otherCategoryText, setOtherCategoryText] = useState("");
  // Hora real elegida por la persona para "¿Cuándo?" (formato "HH:MM" de
  // <input type="time">), separada de WHEN_OPTIONS: antes cada opción ("Esta
  // noche", "Mañana", "Este finde") traía una hora fija hardcodeada en
  // draftWhenToStartsAtIso (20:00 / 18:00 / 12:00) que se guardaba tal cual sin
  // que la persona la hubiera elegido nunca — por eso el plan siempre terminaba
  // a las 6:00pm si elegía "Mañana". Arranca vacío (no se precarga con esas
  // horas fijas ni con ninguna otra, para no mostrar una hora ficticia como si
  // ya estuviera elegida) y solo se muestra/pide cuando "Ahora" no es la
  // opción (para "Ahora" se sigue usando la hora real del momento, sin picker).
  const [timeStr, setTimeStr] = useState("");
  // Estado del selector de ubicación en mapa ("📍 Elegir ubicación", ver más abajo)
  // y de la solicitud de GPS para "📍 Cerca de mí". Ninguno de los dos reemplaza a
  // getCurrentCoords (definida arriba en este archivo): "Cerca de mí" la llama
  // directamente acá para fijar el pin de una vez, en vez de esperar a publicar.
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locatingNear, setLocatingNear] = useState(false);
  const [nearLocationError, setNearLocationError] = useState(null);
  // Indicador visual de scroll (solo paso 1): el scroll real ocurre en el
  // contenedor ancestro .qs-mid (ver AppShell), no acá adentro — por eso se
  // detecta ahí mismo en vez de crear un scroll propio nuevo. Se recalcula al
  // hacer scroll, al cambiar de tamaño y cada vez que el paso 1 revela más
  // campos (la lista de dependencias de abajo), y solo se muestra si de
  // verdad queda contenido por debajo sin ver.
  const rootRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  useEffect(() => {
    if (step !== 1) { setShowScrollHint(false); return; }
    const scrollEl = rootRef.current?.closest(".qs-mid");
    if (!scrollEl) return;
    const check = () => {
      const hasMore = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight > 12;
      setShowScrollHint(hasMore);
    };
    check();
    scrollEl.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(scrollEl);
    return () => {
      scrollEl.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      ro?.disconnect();
    };
  }, [step, draft.cat, draft.when, draft.mode, draft.count, timeStr]);
  const back = () => (step === 1 ? onCancel() : setStep((s) => s - 1));
  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  // Con "＋ Otro" seleccionado, el paso 1 no se da por completo hasta que haya
  // texto real de categoría (ver CREATE_CATS/otherCategoryText arriba). Igual
  // con la hora: si "¿Cuándo?" no es "Ahora", hace falta que la persona haya
  // elegido una hora real en el picker (ver timeStr arriba) — así nunca se
  // avanza con una hora fija que nadie eligió.
  const needsTime = draft.when && draft.when.key !== "ahora";
  const step1Complete = !!(
    draft.cat && (draft.cat.cat !== "otro" || otherCategoryText.trim()) && draft.when && (!needsTime || timeStr) && draft.mode && draft.count
  );
  // Categoría final a mostrar/guardar: si se eligió "＋ Otro", usa el texto escrito
  // (mismo valor para label y cat, ya que una categoría personalizada no tiene un
  // nombre "técnico" distinto del que la persona escribió); si no, el draft.cat de
  // siempre. Se calcula acá (no se pisa draft.cat en cada tecla) para que el campo
  // de texto pueda pasar por vacío mientras se escribe sin romper nada.
  const resolvedCat = draft.cat?.cat === "otro"
    ? { label: otherCategoryText.trim() || "Otro", cat: otherCategoryText.trim() || "Otro", emoji: "🏷️" }
    : draft.cat;

  // "📍 Cerca de mí": pide el GPS ya mismo (reutiliza getCurrentCoords, la misma
  // función que ya usaba handlePublish en AppShell) y deja el pin listo antes de
  // publicar, en vez de recién pedirlo al final sin que la persona lo haya elegido.
  const handleUseNear = async () => {
    setNearLocationError(null);
    setLocatingNear(true);
    const { coords, errorCode } = await getCurrentCoords();
    setLocatingNear(false);
    if (!coords) {
      setNearLocationError(
        errorCode === 1
          ? "El permiso de ubicación está bloqueado para este sitio. Permítelo desde los ajustes del navegador e inténtalo de nuevo."
          : "No pudimos obtener tu ubicación. Revisa tu GPS/conexión e inténtalo de nuevo."
      );
      return;
    }
    setDraft((d) => ({ ...d, coords, coordsSource: "near" }));
  };

  const sectionTitle = { fontFamily: FD, fontWeight: 700, fontSize: 19, color: INK, margin: "22px 0 14px" };
  const sectionTitleFirst = { ...sectionTitle, margin: "6px 0 14px" };

  const selectableChip = (selected) => ({
    border: selected ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`,
    background: selected ? BRAND_BG : "white",
    borderRadius: 20, padding: "18px 10px", display: "flex", flexDirection: "column",
    alignItems: "center", gap: 8, cursor: "pointer",
    boxShadow: selected ? `0 4px 14px ${BRAND}33` : "0 2px 10px rgba(22,21,32,.05)",
    transition: "all .15s ease",
  });

  return (
    <div ref={rootRef} style={{ background: CREAM, minHeight: 560, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 0" }}>
        <button onClick={back} style={{ border: "none", background: LINE, borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <ChevronLeft size={19} color={INK} />
        </button>
        <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 16, margin: 0, color: INK }}>Crear plan</p>
        <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 11.5, color: MUTED, margin: "0 0 0 auto" }}>Paso {step} de {TOTAL_STEPS}</p>
      </div>
      {/* Barra de progreso: 3 segmentos anchos y claros, uno por paso real del wizard. */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px 0" }}>
        {[1, 2, 3].map((s) => (
          <span key={s} style={{ flex: 1, height: 5, borderRadius: 4, background: s <= step ? BRAND : LINE, transition: "background .2s ease" }} />
        ))}
      </div>

      <div style={{ padding: "6px 20px 24px", flex: 1 }}>
        {step === 1 && (<>
          <p style={sectionTitleFirst}>Categoría</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {CREATE_CATS.map((c) => {
              const color = CAT_COLORS[c.cat] || BRAND;
              // El tile "＋ Otro" se resalta por su valor sentinel (cat === "otro"),
              // no por label: una vez que la persona escribe su categoría más abajo,
              // draft.cat.label deja de ser "＋ Otro" pero el tile debe seguir marcado.
              const selected = c.cat === "otro" ? draft.cat?.cat === "otro" : draft.cat?.label === c.label;
              return (
                <button key={c.label} onClick={() => setDraft({ ...draft, cat: c })} style={selectableChip(selected)}>
                  <span style={{ width: 46, height: 46, borderRadius: 14, background: `${color}1F`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{c.emoji}</span>
                  <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: INK }}>{c.label}</span>
                </button>
              );
            })}
          </div>

          {draft.cat?.cat === "otro" && (
            <input
              autoFocus
              value={otherCategoryText}
              onChange={(e) => setOtherCategoryText(e.target.value)}
              placeholder="Escribe tu categoría (ej. Concierto, Feria...)"
              // fontSize en 16px (no 13px): en Safari/Chrome móvil, un input con
              // font-size menor a 16px hace que el navegador haga zoom automático
              // de toda la pantalla al enfocarlo. 16px es el mínimo que evita ese
              // zoom sin tocar el layout (mismo padding/alto de siempre).
              style={{ width: "100%", marginTop: 10, fontFamily: FB, fontSize: 16, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${LINE}`, outline: "none", boxSizing: "border-box" }}
            />
          )}

          {draft.cat && (
            <>
              <p style={sectionTitle}>¿Cuándo?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {WHEN_OPTIONS.map((w) => (
                  <ChoiceCard key={w.key} icon={w.emoji} iconBg={`${BRAND}14`} title={w.label} selected={draft.when?.key === w.key} onClick={() => setDraft({ ...draft, when: w })} />
                ))}
              </div>

              {/* Hora real del plan: solo se pide cuando "¿Cuándo?" no es "Ahora"
                  (ahí sí tiene sentido elegir un horario concreto dentro de ese
                  día). Arranca vacío a propósito — nunca se precarga con 20:00/
                  18:00/12:00 como si la persona ya los hubiera elegido — y hasta
                  que no se completa, step1Complete no deja avanzar (ver arriba). */}
              {needsTime && (
                <>
                  <p style={sectionTitle}>¿A qué hora?</p>
                  <input
                    type="time"
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    style={{ width: "100%", fontFamily: FB, fontSize: 16, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${LINE}`, outline: "none", boxSizing: "border-box" }}
                  />
                </>
              )}
            </>
          )}

          {draft.cat && draft.when && (
            <>
              <p style={sectionTitle}>¿Vas solo o en grupo?</p>
              <div style={{ display: "flex", gap: 10 }}>
                {[{ k: "solo", label: "Voy solo/a", emoji: "🙋" }, { k: "grupo", label: "Somos un grupo", emoji: "👥" }].map((o) => {
                  const selected = draft.mode === o.k;
                  return (
                    <button key={o.k} onClick={() => setDraft({ ...draft, mode: o.k })} style={{ ...selectableChip(selected), flex: 1, padding: "24px 10px" }}>
                      <span style={{ width: 52, height: 52, borderRadius: "50%", background: `${BRAND}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{o.emoji}</span>
                      <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: INK }}>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {draft.cat && draft.when && draft.mode && (
            <>
              <p style={sectionTitle}>¿Cuántas personas buscamos?</p>
              <div style={{ display: "flex", gap: 8 }}>
                {["1", "2", "3", "4", "5+"].map((n) => {
                  const selected = draft.count === n;
                  return (
                    <button key={n} onClick={() => setDraft({ ...draft, count: n })} style={{ flex: 1, border: selected ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`, background: selected ? BRAND_BG : "white", borderRadius: 14, padding: "16px 0", fontFamily: FD, fontWeight: 700, fontSize: 16, color: selected ? BRAND_DARK : INK, cursor: "pointer" }}>{n}</button>
                  );
                })}
              </div>
            </>
          )}
        </>)}

        {step === 2 && (<>
          <p style={sectionTitleFirst}>¿Quién puede unirse?</p>
          <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "-8px 0 18px" }}>Podés cambiarlo después desde "Editar plan".</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={() => setDraft({ ...draft, joinPolicy: "open" })} style={{ textAlign: "left", border: draft.joinPolicy === "open" ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`, background: draft.joinPolicy === "open" ? BRAND_BG : "white", borderRadius: 22, padding: 20, cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start", boxShadow: draft.joinPolicy === "open" ? `0 4px 14px ${BRAND}33` : "0 2px 10px rgba(22,21,32,.05)" }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, background: "#E3F9EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🌍</span>
              <div>
                <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 15.5, color: INK, margin: "0 0 4px" }}>Entrada libre</p>
                <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: 0, lineHeight: 1.4 }}>Cualquiera puede unirse directamente.</p>
              </div>
            </button>
            <button onClick={() => setDraft({ ...draft, joinPolicy: "approval" })} style={{ textAlign: "left", border: draft.joinPolicy === "approval" ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`, background: draft.joinPolicy === "approval" ? BRAND_BG : "white", borderRadius: 22, padding: 20, cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start", boxShadow: draft.joinPolicy === "approval" ? `0 4px 14px ${BRAND}33` : "0 2px 10px rgba(22,21,32,.05)" }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, background: BRAND_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🙋</span>
              <div>
                <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 15.5, color: INK, margin: "0 0 4px" }}>Necesito aprobar</p>
                <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: 0, lineHeight: 1.4 }}>Las personas deben enviar una solicitud y vos decides si aceptar o rechazar.</p>
              </div>
            </button>
          </div>
        </>)}

        {step === 3 && draft.cat && (<>
          <p style={sectionTitleFirst}>🎉 ¡Listo para publicar!</p>
          <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "-8px 0 14px" }}>Así se verá tu plan apenas lo publiques.</p>

          {/* Vista previa tipo tarjeta de Feed/Descubrir: banner con color+emoji de la
              categoría (todavía no hay foto real hasta publicar) en vez de un bloque de
              texto plano — para que se sienta como una tarjeta de app, no un resumen de formulario. */}
          <div style={{ borderRadius: 22, overflow: "hidden", boxShadow: "0 6px 18px rgba(22,21,32,.08)" }}>
            <div style={{ position: "relative", height: 120, background: `${CAT_COLORS[resolvedCat.cat] || BRAND}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 52 }}>{resolvedCat.emoji}</span>
              <span style={{ position: "absolute", top: 10, left: 10, fontFamily: FB, fontWeight: 700, fontSize: 10.5, color: "white", background: CAT_COLORS[resolvedCat.cat] || BRAND, padding: "4px 10px", borderRadius: 20 }}>{resolvedCat.label}</span>
            </div>
            <div style={{ background: "white", padding: "14px 16px" }}>
              <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 16, margin: "0 0 8px", color: INK }}>¿{resolvedCat.label}?</p>
              <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}><Clock size={12} /> {draft.when.label}</p>
              <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}><Users size={12} /> {draft.mode === "grupo" ? "Somos un grupo" : "Voy solo/a"} · buscamos {draft.count}</p>
              <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>{draft.joinPolicy === "approval" ? "🙋 Necesito aprobar" : "🌍 Entrada libre"}</p>
              {/* "(detectada)" era falso: ese texto nunca salía del GPS ni de ningún
                  geocoding, era el valor fijo "Miraflores, Lima" (ver useState de
                  arriba) salvo que la persona lo edite a mano. Ahora, sin texto
                  cargado, se muestra directamente el campo para escribirlo — nunca
                  se afirma que algo fue "detectado" sin serlo. */}
              {/* Sin autoFocus: al entrar al paso 3 este input aparece de entrada
                  (draft.location empieza vacío) y el autoFocus anterior abría el
                  teclado y seleccionaba el campo solo, disparando el zoom del
                  navegador apenas se pisaba el paso. Ahora la persona lo toca
                  cuando quiere escribir. fontSize en 16px (no 13px) por la misma
                  razón que el input de "＋ Otro": evita el zoom automático de
                  Safari/Chrome móvil también cuando sí se enfoca a mano.
                  Siempre es el mismo <input> (nunca se reemplaza por un <p>,
                  ver comentario del estado "editLoc" removido más arriba): así
                  no se remonta ni pierde foco/teclado en cada letra. */}
              <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="¿Dónde es el plan?" style={{ width: "100%", marginTop: 6, fontFamily: FB, fontSize: 16, padding: "8px 10px", borderRadius: 10, border: `1.5px solid ${LINE}`, outline: "none", boxSizing: "border-box" }} />

              {/* Coordenadas reales del plan: antes salían SIEMPRE del GPS del
                  dispositivo al momento de publicar (ver handlePublish en AppShell),
                  sin relación con el texto de arriba — si la persona escribía un
                  lugar distinto de donde estaba parada, el pin quedaba mal puesto.
                  Ahora la persona elige de dónde salen esas coordenadas: su GPS
                  actual, o un punto que marca a mano en el mapa (para cuando el
                  plan es en otro lugar). handlePublish usa draft.coords si ya
                  viene resuelto acá, y solo cae de nuevo al GPS al publicar como
                  respaldo si por algo no se llegó a elegir ninguno. */}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={handleUseNear}
                  disabled={locatingNear}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    border: draft.coordsSource === "near" ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`,
                    background: draft.coordsSource === "near" ? BRAND_BG : "white",
                    borderRadius: 12, padding: "10px 8px", fontFamily: FB, fontWeight: 700, fontSize: 12,
                    color: draft.coordsSource === "near" ? BRAND_DARK : INK, cursor: locatingNear ? "default" : "pointer",
                  }}
                >
                  📍 {locatingNear ? "Ubicando…" : "Cerca de mí"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLocationPicker(true)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    border: draft.coordsSource === "choose" ? `2px solid ${BRAND}` : `1.5px solid ${LINE}`,
                    background: draft.coordsSource === "choose" ? BRAND_BG : "white",
                    borderRadius: 12, padding: "10px 8px", fontFamily: FB, fontWeight: 700, fontSize: 12,
                    color: draft.coordsSource === "choose" ? BRAND_DARK : INK, cursor: "pointer",
                  }}
                >
                  📍 Elegir ubicación
                </button>
              </div>
              {nearLocationError && <p style={{ fontFamily: FB, fontSize: 11, color: "#C21E4C", margin: "6px 0 0" }}>{nearLocationError}</p>}
              {draft.coords && !nearLocationError && (
                <p style={{ fontFamily: FB, fontSize: 11, color: MUTED, margin: "6px 0 0" }}>
                  {draft.coordsSource === "near" ? "Usaremos tu ubicación GPS actual para el pin del mapa." : "Usaremos el punto que marcaste en el mapa."}
                </p>
              )}
            </div>
          </div>

          <div style={{ marginTop: 26 }}>
            <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 16, color: INK, margin: "0 0 3px" }}>🚀 Destacar mi plan</p>
            <p style={{ fontFamily: FB, fontSize: 12, color: MUTED, margin: "0 0 12px" }}>Opcional. Tu plan aparece marcado como destacado por el tiempo que elijas.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ChoiceCard
                icon="✨" iconBg="#F2F0FA"
                title="No destacar plan" subtitle="Gratis"
                selected={draft.boost == null}
                onClick={() => setDraft({ ...draft, boost: null })}
              />
              {BOOST_OPTIONS.map((b) => (
                <ChoiceCard
                  key={b.key}
                  icon="🚀" iconBg="#FFF1DC"
                  title={b.label}
                  selected={draft.boost?.key === b.key}
                  onClick={() => setDraft({ ...draft, boost: b })}
                  trailing={
                    <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 13, color: draft.boost?.key === b.key ? BRAND_DARK : MUTED, flexShrink: 0 }}>
                      S/ {b.price.toFixed(2)}
                    </span>
                  }
                />
              ))}
            </div>
          </div>

          {!draft.coords && (
            <div style={{ marginTop: 22, background: "white", border: `1.5px solid ${LINE}`, borderRadius: 20, padding: 18, boxShadow: "0 4px 14px rgba(22,21,32,.06)", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 42, height: 42, borderRadius: 14, background: BRAND_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📍</span>
              <div>
                <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 15, color: INK, margin: "0 0 4px" }}>¿Qué sale? necesita tu ubicación</p>
                <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: 0, lineHeight: 1.45 }}>Elige "Cerca de mí" o "Elegir ubicación" arriba para colocar tu plan en el mapa y mostrarlo a personas cercanas.</p>
              </div>
            </div>
          )}

          {publishError && (
            <div style={{ background: "#FFE9EE", border: "1px solid #FFC2D2", borderRadius: 10, padding: "10px 12px", marginTop: 10 }}>
              <p style={{ fontFamily: FB, fontSize: 12.5, color: "#C21E4C", margin: 0 }}>{publishError}</p>
            </div>
          )}
        </>)}
      </div>

      {/* Indicador discreto de "hay más contenido abajo" para el paso 1. Sticky
          dentro del flujo (con margen negativo para no sumar espacio extra),
          así queda pegado al fondo del área visible mientras se pueda seguir
          bajando y desaparece solo al llegar al final o si todo entra en
          pantalla. No agrega scroll propio ni tapa el botón "Siguiente". */}
      {/* DIAGNÓSTICO TEMPORAL: render comentado para descartar si este
          elemento (sticky + margen negativo dentro de un flex-column) está
          causando el comportamiento de scroll "trabado" reportado en móvil.
          El useEffect que calcula showScrollHint sigue activo, sin tocar. */}
      {/* {step === 1 && showScrollHint && (
        <div style={{ position: "sticky", bottom: 0, height: 34, marginTop: -34, background: `linear-gradient(to bottom, rgba(250,247,242,0) 0%, ${CREAM} 80%)`, pointerEvents: "none", zIndex: 2 }} />
      )} */}

      <div style={{ padding: "0 20px 24px" }}>
        {step === 1 && (
          <button onClick={next} disabled={!step1Complete} style={{ width: "100%", border: "none", borderRadius: 14, padding: 15, fontFamily: FB, fontWeight: 700, fontSize: 14.5, cursor: step1Complete ? "pointer" : "default", background: step1Complete ? BRAND : "#D8D2E8", color: "white" }}>Siguiente</button>
        )}
        {step === 2 && (
          <button onClick={next} style={{ width: "100%", border: "none", borderRadius: 14, padding: 15, fontFamily: FB, fontWeight: 700, fontSize: 14.5, cursor: "pointer", background: BRAND, color: "white" }}>Siguiente</button>
        )}
        {step === 3 && (() => {
          // La ubicación ya no trae un valor por defecto (ver useState de arriba), y
          // ahora tampoco alcanza con el texto: hace falta además haber elegido de
          // dónde salen las coordenadas reales del pin ("Cerca de mí" o "Elegir
          // ubicación" más arriba), para no volver a depender en silencio del GPS
          // del dispositivo al momento de publicar.
          const hasLocation = !!draft.location.trim();
          const hasCoords = !!draft.coords;
          const disabledReason = !hasLocation || !hasCoords;
          const label = publishing
            ? "Publicando…"
            : !hasLocation
              ? "Escribe dónde es el plan"
              : !hasCoords
                ? "Elige tu ubicación arriba"
                : "🚀 Publicar plan";
          return (
            <button
              onClick={() => onPublish({ ...draft, cat: resolvedCat, time: timeStr })}
              disabled={publishing || disabledReason}
              style={{ width: "100%", border: "none", borderRadius: 14, padding: 15, fontFamily: FB, fontWeight: 700, fontSize: 14.5, cursor: (publishing || disabledReason) ? "default" : "pointer", background: (publishing || disabledReason) ? "#B9AEEF" : BRAND, color: "white" }}
            >
              {label}
            </button>
          );
        })()}
      </div>

      {showLocationPicker && (
        <LocationPicker
          initialCoords={draft.coordsSource === "choose" ? draft.coords : null}
          onCancel={() => setShowLocationPicker(false)}
          onConfirm={(point) => {
            setDraft((d) => ({ ...d, coords: point, coordsSource: "choose" }));
            setShowLocationPicker(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Editar plan (solo el creador llega aquí, ver PlanDetail/AppShell) ---------- */

export { QuickCreate };
