// Funciones que no necesitan estado de React. Mantenerlas fuera del componente principal
// hace que el archivo de UI sea más fácil de leer y permite probarlas por separado.
import { CAT_COLORS } from "./categories";

const LIMA_OFFSET_HOURS = 5;

function limaDateKeyFromDate(date) {
  // "YYYY-MM-DD" en horario de Lima, sin importar la zona horaria del navegador/servidor.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function limaPartsFromDate(date) {
  const [y, m, d] = limaDateKeyFromDate(date).split("-").map(Number);
  return { year: y, month: m, day: d };
}
function limaDateTimeToUtcIso(year, month, day, hour, minute) {
  // Construye el instante UTC correspondiente a una fecha/hora en horario de Lima.
  return new Date(Date.UTC(year, month - 1, day, hour + LIMA_OFFSET_HOURS, minute, 0)).toISOString();
}
function limaNoonUtcForToday(now) {
  const { year, month, day } = limaPartsFromDate(now);
  return new Date(Date.UTC(year, month - 1, day, 12 + LIMA_OFFSET_HOURS, 0, 0));
}
// Convierte la opción elegida en el paso "¿Cuándo?" del formulario en un starts_at real (timestamptz).
// timeStr es la hora real que la persona eligió en el picker (formato "HH:MM" de
// <input type="time">, ver QuickCreate). Antes esta función SIEMPRE usaba una
// hora fija hardcodeada (20:00/18:00/12:00 según la opción) sin importar lo que
// la persona quisiera — por eso "Mañana" terminaba publicando siempre a las
// 6:00pm. Ahora, si viene una hora real y es válida, se usa exactamente esa
// (la fecha —hoy/mañana/el próximo sábado— no cambia, solo la hora dentro de
// ese día). Los valores fijos de antes quedan solo como respaldo por si se
// llama sin timeStr (EditPlan, más abajo, sigue haciéndolo así y no se tocó).
function draftWhenToStartsAtIso(whenKey, timeStr) {
  const now = new Date();
  if (whenKey === "ahora") return now.toISOString();
  const [hh, mm] = typeof timeStr === "string" ? timeStr.split(":").map(Number) : [];
  const hasTime = Number.isFinite(hh) && Number.isFinite(mm);
  const { year, month, day } = limaPartsFromDate(now);
  if (whenKey === "noche") return limaDateTimeToUtcIso(year, month, day, hasTime ? hh : 20, hasTime ? mm : 0); // hoy, 8:00pm si no se eligió hora
  if (whenKey === "mañana") {
    const tomorrowNoonUtc = new Date(limaNoonUtcForToday(now).getTime() + 24 * 3600 * 1000);
    const t = limaPartsFromDate(tomorrowNoonUtc);
    return limaDateTimeToUtcIso(t.year, t.month, t.day, hasTime ? hh : 18, hasTime ? mm : 0); // mañana, 6:00pm si no se eligió hora
  }
  if (whenKey === "finde") {
    const todayNoonUtc = limaNoonUtcForToday(now);
    const weekday = todayNoonUtc.getUTCDay(); // 0=domingo … 6=sábado
    const daysUntilSat = (6 - weekday + 7) % 7;
    const satNoonUtc = new Date(todayNoonUtc.getTime() + daysUntilSat * 24 * 3600 * 1000);
    const s = limaPartsFromDate(satNoonUtc);
    return limaDateTimeToUtcIso(s.year, s.month, s.day, hasTime ? hh : 12, hasTime ? mm : 0); // sábado, 12:00pm si no se eligió hora
  }
  return now.toISOString();
}
// Clasifica un plan real (por su starts_at) en las mismas pestañas que ya existían: ahora / hoy / finde.
function bucketForStartsAt(startsAtIso) {
  const now = new Date();
  const start = new Date(startsAtIso);
  const diffMin = (start.getTime() - now.getTime()) / 60000;
  if (diffMin <= 120 && diffMin >= -180) return "ahora"; // ya empezó hace poco o empieza en <2h
  const todayKey = limaDateKeyFromDate(now);
  const startKey = limaDateKeyFromDate(start);
  if (startKey === todayKey) return "hoy";
  const todayNoonUtc = limaNoonUtcForToday(now);
  const weekday = todayNoonUtc.getUTCDay();
  const daysUntilSat = (6 - weekday + 7) % 7;
  const satNoonUtc = new Date(todayNoonUtc.getTime() + daysUntilSat * 24 * 3600 * 1000);
  const sunNoonUtc = new Date(satNoonUtc.getTime() + 24 * 3600 * 1000);
  if (startKey === limaDateKeyFromDate(satNoonUtc) || startKey === limaDateKeyFromDate(sunNoonUtc)) return "finde";
  return diffMin < 0 ? "hoy" : "finde"; // no cae exacto en un balde: lo mostramos igual en vez de ocultarlo
}
const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Genera la etiqueta visible ("Hoy · 4:30 PM", "Sáb · 9:00 AM"...) a partir del starts_at real.
function formatPlanWhen(startsAtIso) {
  const now = new Date();
  const start = new Date(startsAtIso);
  const todayKey = limaDateKeyFromDate(now);
  const startKey = limaDateKeyFromDate(start);
  const tomorrowKey = limaDateKeyFromDate(new Date(now.getTime() + 24 * 3600 * 1000));
  const timeLabel = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "numeric", minute: "2-digit", hour12: true }).format(start);
  let dayLabel;
  if (startKey === todayKey) dayLabel = "Hoy";
  else if (startKey === tomorrowKey) dayLabel = "Mañana";
  else {
    const parts = limaPartsFromDate(start);
    dayLabel = WEEKDAY_SHORT[new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12 + LIMA_OFFSET_HOURS, 0, 0)).getUTCDay()];
  }
  return `${dayLabel} · ${timeLabel}`;
}
// Convierte una fila real de public.plans (+ su perfil de creador, si lo tenemos) al mismo formato
// que ya usan las tarjetas/detalle existentes, para no tener que rediseñar nada.
// Única fuente de verdad para lo que debe decir/hacer el botón de unirse,
// usada por PlanCard, PlanDetail y DiscoverMap para que los tres se comporten
// igual. `reqStatus` es el estado de MI solicitud a este plan puntual
// (undefined | "pending" | "accepted" | "rejected"), ya cargado en loadPlans.
function joinButtonInfo(plan, joined, reqStatus) {
  if (joined) return { label: "✓ Apuntado", kind: "leave" };
  if (plan.joinPolicy === "approval") {
    if (reqStatus === "pending") return { label: "Solicitud enviada", kind: "cancel" };
    if (reqStatus === "rejected") return { label: "Solicitud rechazada", kind: "rejected" };
    return { label: "Solicitar unirme", kind: "request" };
  }
  return { label: "Me apunto", kind: "join" };
}

function normalizePlanRow(row, profilesById, participantCount = 0, isJoinedByCurrentUser = false, likeCount = 0, isLikedByCurrentUser = false, commentCount = 0) {
  const prof = profilesById?.[row.creator_id];
  const creatorName = prof?.display_name || prof?.username || "Usuario";
  const when = bucketForStartsAt(row.starts_at);
  return {
    id: row.id,
    title: row.title,
    hook: row.description || "",
    location: row.location_name || "Ubicación por confirmar",
    time: formatPlanWhen(row.starts_at),
    category: row.category || "Otros",
    capacity: row.capacity || 1,
    // PlanCard/PlanDetail ya calculan total = plan.joined + (joined ? 1 : 0), donde `joined`
    // es el booleano local de "¿el usuario actual está apuntado?". Para que ese total sea el
    // conteo real (participantCount) sin duplicar al usuario actual, restamos aquí su propia
    // fila si ya está apuntado; se vuelve a sumar según su estado en cada render.
    joined: Math.max(0, participantCount - (isJoinedByCurrentUser ? 1 : 0)),
    // Mismo truco que con "joined": guardamos el conteo real menos el like del
    // usuario actual (si lo dio), y la UI vuelve a sumarlo según su estado local
    // en cada render (así el contador queda correcto tras un like optimista).
    likeCountBase: Math.max(0, likeCount - (isLikedByCurrentUser ? 1 : 0)),
    commentCount,
    // "Destacado": se calcula al vuelo a partir de featured_until (columna nueva,
    // nullable, en plans) — nunca queda un booleano desincronizado del vencimiento.
    featuredUntil: row.featured_until || null,
    isFeatured: !!row.featured_until && new Date(row.featured_until) > new Date(),
    // "Necesito aprobar": 'open' (default, funciona exactamente igual que antes) o 'approval'.
    joinPolicy: row.join_policy || "open",
    creator: row.creator_id,
    creatorName,
    creatorAvatarUrl: prof?.avatar_url || null,
    creatorColor: BRAND,
    creatorInitial: (creatorName[0] || "?").toUpperCase(),
    when,
    live: when === "ahora",
    group: !!row.is_group,
    photoUrl: row.photo_url || null,
    startsAt: row.starts_at,
    // Para el mapa (Descubrir). Si el plan no tiene coordenadas guardadas, quedan en
    // null y ese plan simplemente no aparece como pin — sigue funcionando igual en
    // Feed, Mis planes, etc.
    lat: typeof row.latitude === "number" ? row.latitude : null,
    lng: typeof row.longitude === "number" ? row.longitude : null,
    startsIn: when === "ahora" ? "Publicado recientemente" : undefined,
    recentJoin: when === "ahora" ? "Sé de los primeros en apuntarte" : undefined,
  };
}
// Intenta obtener la ubicación actual del dispositivo (para usarla como coordenadas
// del pin del plan en el mapa). Si el usuario no da permiso, el navegador no lo
// soporta, o tarda demasiado, resuelve null en vez de fallar — el plan simplemente
// se crea sin pin en el mapa, pero sigue funcionando en todo lo demás.
function getCurrentCoords(timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { resolve({ coords: null, errorCode: null }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, errorCode: null }),
      (err) => resolve({ coords: null, errorCode: err?.code ?? null }),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 }
    );
  });
}
// Diagnóstico PREVIO a llamar getCurrentCoords (no la reemplaza ni duplica su
// lógica: getCurrentCoords sigue siendo la única que llama a
// getCurrentPosition). Existe porque en Chrome, cuando el permiso de
// ubicación ya quedó bloqueado para el sitio (o el sitio no está en un
// contexto seguro/https), el navegador NUNCA vuelve a mostrar el aviso de
// permiso: rechaza al toque con el mismo error genérico que cualquier otra
// falla. Este chequeo detecta esos dos casos de antemano para poder mostrar
// un mensaje claro de cómo habilitarlo, en vez del error genérico. Si el
// permiso todavía no fue decidido ("prompt") o el navegador no soporta la
// Permissions API para geolocalización, no bloquea nada: getCurrentCoords
// sigue su curso normal y el navegador muestra su aviso nativo como siempre.
async function checkLocationBlocked() {
  if (typeof window !== "undefined" && window.isSecureContext === false) return "insecure";
  if (typeof navigator !== "undefined" && navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: "geolocation" });
      if (status.state === "denied") return "denied";
    } catch {
      // Permissions API sin soporte para "geolocation" en este navegador: seguimos
      // normalmente, getCurrentCoords se encarga de pedir el permiso.
    }
  }
  return null;
}
// Imagen de fondo de una tarjeta: usa photo_url real si existe. Antes, si no había
// foto propia, caía en una foto de stock aleatoria de loremflickr por categoría
// (ej. "casa" para Playa, "pintura" para Cine) que no correspondía al plan real.
// Ahora, sin foto propia, NO se devuelve ninguna imagen: quien la use debe pintar
// el color+emoji de la categoría (CAT_COLORS/CAT_EMOJI), como ya se hace en el
// detalle del plan. Ver planCardBg() más abajo.
function planImage(plan) {
  return plan.photoUrl || null;
}
// Fondo CSS listo para usar en una tarjeta: la foto real si existe, o el color de
// la categoría (mismo criterio que ya usaba el detalle del plan) si no.
function planCardBg(plan) {
  const photo = planImage(plan);
  return photo ? `#eee url(${photo}) center/cover no-repeat` : `${CAT_COLORS[plan.category] || BRAND}33`;
}



export {
  limaDateKeyFromDate,\n  limaPartsFromDate,\n  limaDateTimeToUtcIso,\n  limaNoonUtcForToday,\n  draftWhenToStartsAtIso,\n  bucketForStartsAt,\n  formatPlanWhen,\n  joinButtonInfo,\n  normalizePlanRow,\n  getCurrentCoords,\n  checkLocationBlocked,\n  planImage,\n  planCardBg
};
