"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../lib/theme";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import {
  Home, Search, Plus, Bell, User, ChevronLeft, MapPin, Clock,
  Send, Bookmark, Check, Users, Dice5, Star, X,
  Share2, UserPlus, MessageCircle, Link2, Instagram, Heart, UserCheck
} from "lucide-react";
import { AuthProvider, useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { CAT_COLORS, CATEGORIES, CAT_EMOJI } from "../lib/categories";
import {
  limaDateKeyFromDate,
  limaPartsFromDate,
  limaDateTimeToUtcIso,
  limaNoonUtcForToday,
  draftWhenToStartsAtIso,
  bucketForStartsAt,
  formatPlanWhen,
  joinButtonInfo,
  normalizePlanRow,
  getCurrentCoords,
  checkLocationBlocked,
  planImage,
  planCardBg,
} from "../lib/planUtils";
import AuthScreen from "./AuthScreen";
import MyAccountProfile from "./MyAccountProfile";
import { STORIES, QUICK_CATS, CREATE_CATS, WHEN_OPTIONS, AVAILABILITY, BOOST_OPTIONS } from "../lib/planConstants";
import { relativeTimeFromNow } from "../lib/planUtils";
import { Avatar, LiveDot, CategoryChips, StoriesRow, TimeTabs, BottomNav, ChoiceCard, TopBar, Toast, LoadingBlock, ErrorBlock } from "./ui/AppPrimitives";
import { ShareSheet, CommentsSheet } from "./plans/PlanSheets";
import { PlanCard } from "./plans/PlanCard";
import { Onboarding } from "./onboarding/Onboarding";
import { Landing } from "./onboarding/Landing";
import { Surprise, Feed, Discover, Saved } from "./feed/Feed";
import { QuickCreate } from "./plans/QuickCreate";
import { EditPlan } from "./plans/EditPlan";
import { JoinRequestsSheet } from "./plans/JoinRequestsSheet";
import { PlanDetail } from "./plans/PlanDetail";
import { Profile } from "./profile/Profile";
import { CreatorProfile } from "./profile/CreatorProfile";
import { ChatScreen } from "./chat/ChatScreen";
import { Activity } from "./activity/Activity";

// Leaflet necesita "window"/"document", así que este mapa NUNCA puede pre-renderizarse
// en el servidor (Next.js) — de ahí el ssr:false. Reemplaza la vista de grilla de
// Descubrir; esa vista (función Discover, más abajo) se deja intacta sin usar por si
// se quisiera volver atrás.
const DiscoverMap = dynamic(() => import("./DiscoverMap"), {
  ssr: false,
  loading: () => <LoadingBlock text="Cargando mapa…" />,
});
// Mismo motivo que DiscoverMap de arriba (Leaflet necesita "window"): selector de
// ubicación en mapa para "Crear plan" (ver QuickCreate / LocationPicker.jsx).
const LocationPicker = dynamic(() => import("./LocationPicker"), { ssr: false });

/* ---------- Design tokens: brand ¿Qué sale? ---------- */


/* ---------- Small pieces ---------- */
function QueSaleApp() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { user, profile, loading: authLoading } = useAuth();
  const [stack, setStack] = useState([{ screen: "landing" }]);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [savedIds, setSavedIds] = useState(new Set());
  const [likedIds, setLikedIds] = useState(new Set());
  // Mis propias solicitudes a planes que requieren aprobación: { [planId]: "pending" | "accepted" | "rejected" }.
  const [requestStatusByPlan, setRequestStatusByPlan] = useState({});
  const [filter, setFilter] = useState("Todos");
  const [tab, setTab] = useState("hoy");
  const [story, setStory] = useState(null);
  const [onboarded, setOnboarded] = useState(false);
  const [interests, setInterests] = useState([]);

  // Persistencia real de "¿Qué te late?": antes onboarded/interests vivían solo
  // en useState (se perdían al recargar). Ahora:
  // - con sesión: la fuente de verdad es profiles.interests (columna ya existente).
  //   null = todavía no completó el onboarding; array (incluso []) = ya lo completó,
  //   sea con intereses elegidos o con "Omitir".
  // - sin sesión: no hay fila de profiles que leer, así que se usa localStorage
  //   como respaldo en este dispositivo/navegador.
  useEffect(() => {
    if (user) {
      if (profile && profile.interests !== undefined && profile.interests !== null) {
        setOnboarded(true);
        setInterests(profile.interests || []);
      }
    } else if (typeof window !== "undefined") {
      if (window.localStorage.getItem("qs_onboarded") === "1") setOnboarded(true);
    }
  }, [user, profile]);
  const [shareState, setShareState] = useState(null);
  const [commentsState, setCommentsState] = useState(null);
  const [toast, setToast] = useState(null);
  // Solo lo usa DiscoverMap, para avisar cuando la vista inmersiva de un plan está
  // abierta y así ocultar el bottom nav mientras dura (se restaura solo al cerrarla).
  const [mapHeroActive, setMapHeroActive] = useState(false);

  // Carga real de planes desde Supabase (public.plans), + los perfiles de sus creadores
  // (consulta aparte a public.profiles por creator_id, ya que no hay una relación de
  // Supabase configurada entre plans y profiles para pedirlo en un solo select anidado).
  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);

    // Sin esto, un plan cuya hora ya pasó hace días se sigue mostrando para siempre
    // en el feed (bucketForStartsAt lo etiqueta como "hoy" indefinidamente si no hay
    // match exacto de fecha). 3h de margen coincide con la ventana que el propio
    // bucketForStartsAt ya usa para considerar un plan como "ahora".
    const cutoffIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from("plans")
      .select("*")
      .gte("starts_at", cutoffIso)
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("[Plans] Error cargando planes:", error.message);
      setPlansError("No pudimos cargar los planes. Verifica tu conexión e inténtalo de nuevo.");
      setPlansLoading(false);
      return;
    }

    const creatorIds = [...new Set((rows || []).map((r) => r.creator_id).filter(Boolean))];
    let profilesById = {};
    if (creatorIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", creatorIds);
      if (profileError) {
        console.error("[Plans] Error cargando perfiles de creadores:", profileError.message);
        // No es fatal: mostramos los planes igual, con un nombre genérico de creador.
      } else {
        for (const p of profileRows || []) profilesById[p.id] = p;
      }
    }

    // Participantes reales desde public.plan_participants: contamos cuántos hay por plan
    // y cuáles incluyen al usuario actual, para que "Me apunto" refleje el estado real
    // guardado en Supabase (persiste igual después de recargar la página).
    const planIds = (rows || []).map((r) => r.id);
    const countByPlan = {};
    const joinedSet = new Set();
    if (planIds.length > 0) {
      const { data: participantRows, error: participantsError } = await supabase
        .from("plan_participants")
        .select("plan_id, user_id")
        .in("plan_id", planIds);
      if (participantsError) {
        console.error("[Participants] Error cargando participantes:", participantsError.message);
        // No es fatal: mostramos los planes igual, aunque sin contador de participantes exacto.
      } else {
        for (const p of participantRows || []) {
          countByPlan[p.plan_id] = (countByPlan[p.plan_id] || 0) + 1;
          if (user && p.user_id === user.id) joinedSet.add(p.plan_id);
        }
      }
    }

    // Favoritos reales desde public.favorites: RLS ya limita esto a los del usuario actual,
    // así el botón Guardar refleja el estado real guardado en Supabase tras recargar la página.
    const savedSet = new Set();
    if (user) {
      const { data: favoriteRows, error: favoritesError } = await supabase
        .from("favorites")
        .select("plan_id")
        .eq("user_id", user.id);
      if (favoritesError) {
        console.error("[Favorites] Error cargando favoritos:", favoritesError.message);
        // No es fatal: mostramos los planes igual, aunque sin favoritos marcados.
      } else {
        for (const f of favoriteRows || []) savedSet.add(f.plan_id);
      }
    }

    // Likes reales desde public.plan_likes: mismo patrón que plan_participants
    // (un solo select por lote, contamos por plan y marcamos los del usuario actual).
    const likeCountByPlan = {};
    const likedSet = new Set();
    if (planIds.length > 0) {
      const { data: likeRows, error: likesError } = await supabase
        .from("plan_likes")
        .select("plan_id, user_id")
        .in("plan_id", planIds);
      if (likesError) {
        console.error("[Likes] Error cargando likes:", likesError.message);
        // No es fatal: mostramos los planes igual, aunque sin contador de likes exacto.
      } else {
        for (const l of likeRows || []) {
          likeCountByPlan[l.plan_id] = (likeCountByPlan[l.plan_id] || 0) + 1;
          if (user && l.user_id === user.id) likedSet.add(l.plan_id);
        }
      }
    }

    // Comentarios reales desde public.plan_comments: solo necesitamos el conteo por
    // plan para las tarjetas/detalle; el contenido se carga aparte al abrir el panel.
    const commentCountByPlan = {};
    if (planIds.length > 0) {
      const { data: commentRows, error: commentsError } = await supabase
        .from("plan_comments")
        .select("plan_id")
        .in("plan_id", planIds);
      if (commentsError) {
        console.error("[Comments] Error cargando conteo de comentarios:", commentsError.message);
      } else {
        for (const c of commentRows || []) commentCountByPlan[c.plan_id] = (commentCountByPlan[c.plan_id] || 0) + 1;
      }
    }

    setPlans((rows || []).map((row) => normalizePlanRow(
      row,
      profilesById,
      countByPlan[row.id] || 0,
      joinedSet.has(row.id),
      likeCountByPlan[row.id] || 0,
      likedSet.has(row.id),
      commentCountByPlan[row.id] || 0
    )));
    setJoinedIds(joinedSet);
    setSavedIds(savedSet);
    setLikedIds(likedSet);

    // Mis solicitudes pendientes/resueltas en planes con aprobación (para que el
    // botón muestre "Solicitud enviada"/"Solicitud rechazada" tras recargar).
    if (user && planIds.length > 0) {
      const { data: requestRows, error: requestsError } = await supabase
        .from("plan_join_requests")
        .select("plan_id, status")
        .eq("user_id", user.id)
        .in("plan_id", planIds);
      if (requestsError) {
        console.error("[JoinRequests] Error cargando mis solicitudes:", requestsError.message);
      } else {
        setRequestStatusByPlan(Object.fromEntries((requestRows || []).map((r) => [r.plan_id, r.status])));
      }
    } else {
      setRequestStatusByPlan({});
    }

    setPlansLoading(false);
  }, [user]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // Recupera los intereses guardados en public.profiles al iniciar sesión, para que el
  // onboarding no se repita en cada recarga si el usuario ya los eligió antes.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("interests")
        .eq("id", user.id)
        .single();
      if (error) {
        console.error("[Profile] Error cargando intereses guardados:", error.message);
        return;
      }
      if (data?.interests && data.interests.length > 0) {
        setInterests(data.interests);
        setOnboarded(true);
      }
    })();
  }, [user]);

  const current = stack[stack.length - 1];
  const push = (screen, params = {}) => setStack([...stack, { screen, ...params }]);
  const goBack = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const navBottom = (key) => {
    // El botón "+" (Crear) debe apilarse sobre la pantalla actual, igual que
    // ya hace push() desde el botón "Crear mi primer plan" del Feed, en vez
    // de reemplazar todo el stack: así el botón de volver que ya existe
    // dentro de QuickCreate (ChevronLeft -> onCancel -> goBack) tiene una
    // pantalla anterior a la cual regresar. El resto de tabs de la barra
    // inferior (feed/discover/activity/profile) conserva exactamente el
    // mismo comportamiento de siempre: resetear el stack a una sola pantalla.
    if (key === "create") {
      setStack((s) => [...s, { screen: "create" }]);
      return;
    }
    setStack([{ screen: key }]);
  };
  const showToast = (t) => { setToast(t); setTimeout(() => setToast(null), 1700); };
  const handleJoin = async (id) => {
    if (!user) {
      showToast("Inicia sesión para apuntarte 🙌");
      return;
    }
    const alreadyJoined = joinedIds.has(id);

    // Actualización optimista: el botón responde al toque; si Supabase falla, revertimos.
    setJoinedIds((prev) => { const n = new Set(prev); alreadyJoined ? n.delete(id) : n.add(id); return n; });

    if (alreadyJoined) {
      const { error } = await supabase.from("plan_participants").delete().eq("plan_id", id).eq("user_id", user.id);
      if (error) {
        console.error("[Participants] Error al salir del plan:", error.message);
        setJoinedIds((prev) => new Set(prev).add(id)); // revertir
        showToast("No pudimos actualizar tu apunte. Intenta de nuevo.");
      }
    } else {
      const { error } = await supabase.from("plan_participants").insert({ plan_id: id, user_id: user.id });
      if (error) {
        if (error.code === "23505") {
          // Ya existía la fila (doble clic, etc.): no es un error real, solo sincronizamos el estado.
        } else {
          console.error("[Participants] Error al apuntarse:", error.message);
          setJoinedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); // revertir
          showToast("No pudimos apuntarte. Intenta de nuevo.");
        }
      }
    }
  };
  const handleSave = async (id) => {
    if (!user) {
      showToast("Inicia sesión para guardar planes 🙌");
      return;
    }
    const alreadySaved = savedIds.has(id);

    // Misma mecánica que "Me apunto": actualización optimista + reversión si Supabase falla.
    setSavedIds((prev) => { const n = new Set(prev); alreadySaved ? n.delete(id) : n.add(id); return n; });
    showToast(alreadySaved ? "Quitado de guardados" : "Guardado 🔖");

    if (alreadySaved) {
      const { error } = await supabase.from("favorites").delete().eq("plan_id", id).eq("user_id", user.id);
      if (error) {
        console.error("[Favorites] Error al quitar de guardados:", error.message);
        setSavedIds((prev) => new Set(prev).add(id)); // revertir
        showToast("No pudimos actualizar tus guardados. Intenta de nuevo.");
      }
    } else {
      const { error } = await supabase.from("favorites").insert({ plan_id: id, user_id: user.id });
      if (error) {
        if (error.code === "23505") {
          // Ya existía la fila (doble clic, etc.): no es un error real, solo sincronizamos el estado.
        } else {
          console.error("[Favorites] Error al guardar:", error.message);
          setSavedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); // revertir
          showToast("No pudimos guardar el plan. Intenta de nuevo.");
        }
      }
    }
  };
  // "Solicitar unirme" (planes con join_policy = 'approval'): NO toca plan_participants
  // directo — crea una fila pendiente. La RLS de plan_participants (ver join-requests.sql)
  // es la que de verdad impide unirse sin aprobación, esto es solo la UI.
  const handleRequestJoin = async (id) => {
    if (!user) {
      showToast("Inicia sesión para solicitar unirte 🙌");
      return;
    }
    setRequestStatusByPlan((prev) => ({ ...prev, [id]: "pending" })); // optimista
    const { error } = await supabase.from("plan_join_requests").insert({ plan_id: id, user_id: user.id, status: "pending" });
    if (error) {
      if (error.code === "23505") {
        // Ya existía una solicitud (doble clic, o ya estaba resuelta): sincronizamos con lo real.
        const { data } = await supabase.from("plan_join_requests").select("status").eq("plan_id", id).eq("user_id", user.id).maybeSingle();
        if (data) setRequestStatusByPlan((prev) => ({ ...prev, [id]: data.status }));
      } else {
        console.error("[JoinRequests] Error al solicitar unirse:", error.message);
        setRequestStatusByPlan((prev) => { const n = { ...prev }; delete n[id]; return n; }); // revertir
        showToast("No pudimos enviar tu solicitud. Intenta de nuevo.");
        return;
      }
    }
    showToast("Solicitud enviada 🙌");
    const plan = plans.find((p) => p.id === id);
    if (plan) notify(plan.creator, "quiere unirse a tu plan");
  };
  const handleCancelRequest = async (id) => {
    if (!user) return;
    const previousStatus = requestStatusByPlan[id];
    setRequestStatusByPlan((prev) => { const n = { ...prev }; delete n[id]; return n; }); // optimista
    const { error } = await supabase.from("plan_join_requests").delete().eq("plan_id", id).eq("user_id", user.id).eq("status", "pending");
    if (error) {
      console.error("[JoinRequests] Error al cancelar la solicitud:", error.message);
      setRequestStatusByPlan((prev) => ({ ...prev, [id]: previousStatus })); // revertir
      showToast("No pudimos cancelar tu solicitud. Intenta de nuevo.");
    } else {
      showToast("Solicitud cancelada");
    }
  };
  // patrón simple de mensaje libre que ya usa Activity() para leer `message`.
  const notify = async (recipientId, message) => {
    if (!user || !recipientId || recipientId === user.id) return; // nunca te notificas a ti mismo
    try {
      const { error } = await supabase.from("notifications").insert({ user_id: recipientId, actor_id: user.id, message });
      if (error) console.error("[Notify] Error creando notificación:", error.message);
    } catch (e) {
      console.error("[Notify] Excepción creando notificación:", e);
    }
  };
  const handleLike = async (id) => {
    if (!user) {
      showToast("Inicia sesión para dar like 🙌");
      return;
    }
    const alreadyLiked = likedIds.has(id);
    setLikedIds((prev) => { const n = new Set(prev); alreadyLiked ? n.delete(id) : n.add(id); return n; });

    if (alreadyLiked) {
      const { error } = await supabase.from("plan_likes").delete().eq("plan_id", id).eq("user_id", user.id);
      if (error) {
        console.error("[Likes] Error al quitar like:", error.message);
        setLikedIds((prev) => new Set(prev).add(id)); // revertir
        showToast("No pudimos actualizar tu like. Intenta de nuevo.");
      }
    } else {
      const { error } = await supabase.from("plan_likes").insert({ plan_id: id, user_id: user.id });
      if (error) {
        if (error.code === "23505") {
          // Ya existía la fila: no es un error real, solo sincronizamos el estado.
        } else {
          console.error("[Likes] Error al dar like:", error.message);
          setLikedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); // revertir
          showToast("No pudimos dar like. Intenta de nuevo.");
        }
      } else {
        const likedPlan = plans.find((p) => p.id === id);
        if (likedPlan) notify(likedPlan.creator, "le dio like a tu plan");
      }
    }
  };
  // Suma en memoria un comentario recién publicado, para que el contador de la
  // tarjeta/detalle quede al día sin tener que recargar todos los planes.
  const bumpCommentCount = (id) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p)));
  };
  // Elimina un plan propio (RLS en Supabase ya impide borrar planes ajenos; el
  // .eq("creator_id", user.id) es una defensa extra en el cliente). Al terminar,
  // refresca la lista real desde Supabase y vuelve al feed, porque el plan
  // eliminado ya no existe para mostrarlo en el detalle.
  const handleDeletePlan = async (id) => {
    if (!user) return false;
    const { error } = await supabase.from("plans").delete().eq("id", id).eq("creator_id", user.id);
    if (error) {
      console.error("[Plans] Error eliminando plan:", error.message);
      showToast("No pudimos cancelar el plan. Intenta de nuevo.");
      return false;
    }
    await loadPlans();
    setStack([{ screen: "feed" }]);
    showToast("Plan cancelado y eliminado 🗑️");
    return true;
  };

  // Se llama después de guardar una edición exitosa en EditPlan: refresca los
  // planes reales desde Supabase (para que el detalle muestre los cambios) y
  // vuelve a la pantalla anterior (el detalle del plan).
  const handlePlanUpdated = async () => {
    await loadPlans();
    goBack();
    showToast("✅ Plan actualizado");
  };

  const goLanding = (target) => (onboarded ? setStack([{ screen: target }]) : push("onboarding", { after: target }));

  // Guarda los intereses elegidos en public.profiles cuando hay sesión iniciada, para que
  // persistan al recargar la página (si no hay sesión, quedan solo en memoria como antes).
  const persistInterests = async (its) => {
    // Respaldo local inmediato (cubre el caso sin sesión, donde no existe fila de
    // profiles que actualizar): así "Omitir" también persiste entre recargas.
    if (typeof window !== "undefined") window.localStorage.setItem("qs_onboarded", "1");
    if (!user) return;
    // Se escribe SIEMPRE, incluso con [] (Omitir), para distinguir "ya completó
    // el onboarding sin elegir nada" (interests: []) de "todavía no lo completó"
    // (interests: null, el valor por defecto de la columna).
    const { error } = await supabase.from("profiles").update({ interests: its || [] }).eq("id", user.id);
    if (error) console.error("[Profile] Error guardando intereses:", error.message);
  };

  const finishOnboarding = (its, avs) => { setInterests(its); setOnboarded(true); setStack([{ screen: current.after || "feed" }]); persistInterests(its); };

  const handlePublish = async (draft) => {
    // Seguridad: el creator_id SIEMPRE sale del usuario autenticado real, nunca del formulario.
    if (!user) {
      setPublishError("Debes iniciar sesión para publicar un plan.");
      return;
    }
    setPublishError(null);
    setPublishing(true);

    const missingCount = draft.count === "5+" ? 5 : (parseInt(draft.count, 10) || 1);
    const isGroup = draft.mode === "grupo";
    const startsAt = draftWhenToStartsAtIso(draft.when.key, draft.time);
    // Coordenadas reales del pin: ahora QuickCreate ya las resuelve ANTES de
    // habilitar el botón de publicar, según lo que la persona haya elegido —
    // "📍 Cerca de mí" (su GPS actual) o "📍 Elegir ubicación" (un punto marcado
    // a mano en el mapa, para cuando el plan es en otro lugar). Antes acá se
    // llamaba SIEMPRE a getCurrentCoords al publicar, sin importar el texto de
    // ubicación escrito arriba. Se deja el flujo anterior como red de
    // seguridad únicamente si por algún motivo draft.coords no llegara resuelto.
    let coords = draft.coords || null;
    let errorCode = null;
    if (!coords) {
      // Antes de pedir la ubicación: si el permiso ya quedó bloqueado (o el sitio no
      // está en un contexto seguro), Chrome no muestra ningún aviso nativo y
      // getCurrentCoords fallaría en silencio con el mismo error genérico de
      // siempre. Detectarlo acá permite explicarle a la persona exactamente qué
      // hacer, en vez de repetir el permiso sin que se note.
      const blocked = await checkLocationBlocked();
      if (blocked) {
        setPublishError(
          blocked === "insecure"
            ? "Tu navegador bloquea la ubicación porque este sitio no tiene una conexión segura (https). Avísale al equipo de la app."
            : "El permiso de ubicación está bloqueado para este sitio. En Chrome: toca el candado 🔒 junto a la dirección → Permisos del sitio → Ubicación → Permitir, y vuelve a intentar."
        );
        setPublishing(false);
        return;
      }
      const res = await getCurrentCoords();
      coords = res.coords;
      errorCode = res.errorCode;
    }
    // Si no se logra obtener ninguna coordenada, YA NO se publica el plan con
    // latitude/longitude en null: se informa a la persona y se detiene acá, para
    // que el plan nunca quede invisible en el mapa sin que se entere.
    if (!coords) {
      setPublishError(
        errorCode === 1
          ? "El permiso de ubicación está bloqueado para este sitio. En Chrome: toca el candado 🔒 junto a la dirección → Permisos del sitio → Ubicación → Permitir, y vuelve a intentar."
          : "No pudimos obtener tu ubicación. Revisa tu GPS/conexión y vuelve a intentarlo para poder publicar el plan."
      );
      setPublishing(false);
      return;
    }

    const payload = {
      creator_id: user.id,
      title: `¿${draft.cat.label}?`,
      description: isGroup ? `Somos 1 y buscamos ${missingCount} más.` : `Busco ${missingCount} personas, ¿quién se apunta?`,
      category: draft.cat.cat,
      location_name: draft.location,
      latitude: coords.lat,
      longitude: coords.lng,
      starts_at: startsAt,
      capacity: 1 + missingCount,
      is_group: isGroup,
      photo_url: null,
      status: "active",
      join_policy: draft.joinPolicy || "open",
    };

    const { data: row, error } = await supabase.from("plans").insert(payload).select().single();

    if (error) {
      console.error("[Plans] Error creando plan:", error.message);
      setPublishError(error.message || "No se pudo publicar el plan. Inténtalo de nuevo.");
      setPublishing(false);
      return;
    }

    const { error: participantError } = await supabase
      .from("plan_participants")
      .insert({ plan_id: row.id, user_id: user.id });

    if (participantError) {
      console.error("[Plans] Error inscribiendo al creador:", participantError.message);
      // no bloqueamos la publicación por esto; el plan ya existe
    }

    // "Destacar mi plan": todavía sin cobro real (is_paid queda en false a
    // propósito, ver plan_boosts.sql). Si falla, no bloqueamos la publicación:
    // el plan ya existe y se publicó como gratuito.
    if (draft.boost) {
      const boostStartsAt = new Date();
      const boostEndsAt = new Date(boostStartsAt.getTime() + draft.boost.hours * 60 * 60 * 1000);
      const { error: boostError } = await supabase.from("plan_boosts").insert({
        plan_id: row.id,
        creator_id: user.id,
        tier: draft.boost.key,
        duration_hours: draft.boost.hours,
        price_soles: draft.boost.price,
        starts_at: boostStartsAt.toISOString(),
        ends_at: boostEndsAt.toISOString(),
        status: "active",
        is_paid: false,
      });
      if (boostError) {
        console.error("[Boost] Error creando el destacado:", boostError.message);
      } else {
        const { error: featureError } = await supabase
          .from("plans")
          .update({ featured_until: boostEndsAt.toISOString() })
          .eq("id", row.id)
          .eq("creator_id", user.id);
        if (featureError) console.error("[Boost] Error marcando el plan como destacado:", featureError.message);
      }
    }

    await loadPlans(); // refresca el Feed/Descubrir con datos reales de Supabase, incluido el plan nuevo
    setPublishing(false);
    setStack([{ screen: "feed" }, { screen: "detail", planId: row.id }]);
    showToast("🎉 ¡Tu plan está vivo!");
  };

  let body;
  if (current.screen === "landing") body = <Landing nav={goLanding} plans={plans} plansLoading={plansLoading} />;
  else if (current.screen === "onboarding") body = <Onboarding onDone={finishOnboarding} />;
  else if (current.screen === "feed") {
    if (plansLoading) body = <LoadingBlock text="Cargando planes…" />;
    else if (plansError) body = <ErrorBlock text={plansError} onRetry={loadPlans} />;
    else body = <Feed plans={plans} joinedIds={joinedIds} savedIds={savedIds} likedIds={likedIds} requestStatusByPlan={requestStatusByPlan} onJoin={handleJoin} onSave={handleSave} onLike={handleLike} onRequestJoin={handleRequestJoin} onCancelRequest={handleCancelRequest} onOpen={(id) => push("detail", { planId: id })} onShareOpen={(p) => setShareState({ plan: p, mode: "share" })} tab={tab} setTab={setTab} story={story} setStory={setStory} nav={push} interests={interests} />;
  }
  else if (current.screen === "discover") {
    if (plansLoading) body = <LoadingBlock text="Cargando planes…" />;
    else if (plansError) body = <ErrorBlock text={plansError} onRetry={loadPlans} />;
    else body = <DiscoverMap plans={plans} joinedIds={joinedIds} savedIds={savedIds} requestStatusByPlan={requestStatusByPlan} onJoin={handleJoin} onSave={handleSave} onRequestJoin={handleRequestJoin} onCancelRequest={handleCancelRequest} onShareOpen={(p) => setShareState({ plan: p, mode: "share" })} onChat={(id) => push("chat", { planId: id })} onProfile={(id) => push("personProfile", { personId: id })} filter={filter} setFilter={setFilter} onHeroToggle={setMapHeroActive} />;
  }
  else if (current.screen === "saved") body = <Saved plans={plans} savedIds={savedIds} joinedIds={joinedIds} likedIds={likedIds} requestStatusByPlan={requestStatusByPlan} onJoin={handleJoin} onSave={handleSave} onLike={handleLike} onRequestJoin={handleRequestJoin} onCancelRequest={handleCancelRequest} onOpen={(id) => push("detail", { planId: id })} onShareOpen={(p) => setShareState({ plan: p, mode: "share" })} onBack={goBack} />;
  else if (current.screen === "create") {
    if (!onboarded) {
      body = <Onboarding onDone={(its, avs) => { setInterests(its); setOnboarded(true); persistInterests(its); }} />;
    } else if (authLoading) {
      body = <LoadingBlock text="Verificando tu sesión…" />;
    } else if (!user) {
      // Un usuario sin sesión nunca llega a ver el formulario ni puede insertar nada: solo AuthScreen.
      body = <AuthScreen />;
    } else {
      body = <QuickCreate onPublish={handlePublish} onCancel={goBack} publishing={publishing} publishError={publishError} />;
    }
  }
  else if (current.screen === "activity") body = <Activity />;
  else if (current.screen === "profile") {
    if (authLoading) {
      body = <LoadingBlock text="Verificando tu sesión…" />;
    } else if (user) {
      body = <MyAccountProfile onBack={goBack} />;
    } else {
      body = <AuthScreen />;
    }
  }
  else if (current.screen === "detail") {
    const plan = plans.find((p) => p.id === current.planId);
    if (!plan) {
      body = <LoadingBlock text={plansLoading ? "Cargando plan…" : "No encontramos este plan."} />;
    } else {
      body = <PlanDetail plan={plan} joined={joinedIds.has(plan.id)} saved={savedIds.has(plan.id)} liked={likedIds.has(plan.id)} reqStatus={requestStatusByPlan[plan.id]} onJoin={handleJoin} onSave={handleSave} onLike={handleLike} onRequestJoin={handleRequestJoin} onCancelRequest={handleCancelRequest} onBack={goBack} onChat={() => push("chat", { planId: plan.id })} onProfile={() => push("personProfile", { personId: plan.creator })} onOpenPerson={(id) => push("personProfile", { personId: id })} onShareOpen={(p) => setShareState({ plan: p, mode: "share" })} onInviteOpen={(p) => setShareState({ plan: p, mode: "invite" })} onCommentsOpen={(p) => setCommentsState({ plan: p })} onEdit={(id) => push("editPlan", { planId: id })} onDelete={handleDeletePlan} />;
    }
  }
  else if (current.screen === "editPlan") {
    const plan = plans.find((p) => p.id === current.planId);
    if (!plan) {
      body = <LoadingBlock text={plansLoading ? "Cargando plan…" : "No encontramos este plan."} />;
    } else if (!user || plan.creator !== user.id) {
      // Defensa extra en el cliente: si alguien llega aquí sin ser el creador
      // (por ejemplo manipulando la navegación), no se muestra el formulario.
      body = <ErrorBlock text="No tienes permiso para editar este plan." onRetry={goBack} />;
    } else {
      body = <EditPlan plan={plan} onCancel={goBack} onSaved={handlePlanUpdated} />;
    }
  }
  else if (current.screen === "chat") {
    const plan = plans.find((p) => p.id === current.planId);
    body = plan ? <ChatScreen plan={plan} onBack={goBack} onToast={showToast} /> : <LoadingBlock text="Cargando…" />;
  }
  else if (current.screen === "personProfile") {
    // Antes, si personId coincidía con una de las claves del diccionario mock
    // PEOPLE, se mostraba ese perfil inventado en vez del perfil real. Ahora
    // siempre se usa CreatorProfile, que trae los datos reales de
    // public.profiles (y sus planes/seguidores reales) desde Supabase.
    body = <CreatorProfile personId={current.personId} onBack={goBack} />;
  }

  const showNav = ["feed", "discover", "activity", "profile"].includes(current.screen) && !mapHeroActive;
  // Solo la pantalla del mapa rompe el marco de teléfono (380x680) y pasa a ocupar
  // el viewport real completo (position:fixed + inset:0, no solo el ancho de su
  // contenedor) para sentirse como una app de mapa de verdad — todas las demás
  // pantallas del V5 quedan exactamente como estaban, sin tocar nada.
  const isMapScreen = current.screen === "discover";
  // La Landing necesita centrarse verticalmente dentro de .qs-mid (ver más
  // abajo, clase .qs-landing-center) — el resto de pantallas no cambia.
  const isLanding = current.screen === "landing";
  // Detalle de plan (PlanDetail): igual que Landing, no lleva ninguna clase
  // modificadora propia (no es wide/full-bleed), así que en móvil sus esquinas
  // superiores dependían por completo de la regla base .qs-shell externa a
  // este archivo, que no define ningún radio ahí — quedaba con esquinas
  // rectas. Reutiliza la misma clase .qs-shell-rounded que ya soluciona esto
  // para Landing (mismo border-radius: 22px 22px 0 0), sin heredar el resto
  // del comportamiento de Landing (no se usa en midClassName/qs-landing-center,
  // que solo debe seguir aplicando a Landing).
  const isDetailScreen = current.screen === "detail";
  // Ajuste visual pedido para Feed/Actividad/Crear: panel con margen lateral
  // reducido, sin franja debajo antes del BottomNav, esquinas superiores
  // redondeadas. Va en una clase aparte (qs-shell-wide) y NO en .qs-shell
  // directamente porque .qs-shell es compartida con Landing/Guardados,
  // que no deben cambiar. Perfil usa una clase DISTINTA (qs-shell-full, ver
  // más abajo) porque ahí el pedido es ancho completo, sin ningún margen —
  // no el mismo margen de 12px que ya quedó bien en Feed/Actividad/Crear.
  const isWidePanelScreen = current.screen === "feed" || current.screen === "activity" || current.screen === "create";
  const isFullBleedScreen = current.screen === "profile";

  // shellStyle/midStyle: el ancho/alto de la "tarjeta" ya NO se fija en JS inline
  // (eso era lo que forzaba 380x680 sin importar el tamaño de ventana). Ahora
  // solo quedan aquí las propiedades que no cambian por breakpoint; el ancho y
  // el alto viven en las clases .qs-shell/.qs-mid de más abajo, con su @media
  // para desktop. El mapa (isMapScreen) sigue exactamente igual que antes.
  const shellStyle = isMapScreen
    ? { position: "fixed", inset: 0, margin: 0, fontFamily: FB, background: CREAM, border: "none", borderRadius: 0, overflow: "hidden", display: "flex", flexDirection: "column", zIndex: 100 }
    : { fontFamily: FB, background: CREAM, overflow: "hidden", border: `1px solid ${LINE}`, position: "relative" };
  const midStyle = isMapScreen
    ? { flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }
    : { position: "relative" };
  const shellClassName = isMapScreen ? undefined : `qs-shell${isWidePanelScreen ? " qs-shell-wide" : ""}${isFullBleedScreen ? " qs-shell-full" : ""}${(isLanding || isDetailScreen) ? " qs-shell-rounded" : ""}`;
  const midClassName = isMapScreen ? undefined : `qs-mid${isLanding ? " qs-landing-center" : ""}`;

  const shell = (
    <div style={shellStyle} className={shellClassName}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        @keyframes qsPulse { 0% { transform: scale(1); opacity: .8; } 70% { transform: scale(2.6); opacity: 0; } 100% { opacity: 0; } }

        /* Responsive del "marco" (Feed / Crear / Actividad / Perfil).
           El mapa de Descubrir no usa estas clases: sigue fullscreen vía su
           propio shellStyle (position:fixed; inset:0), sin cambios.
           Mobile: idéntico al V5 original (tarjeta de 380x680 con scroll interno).
           Desktop (>=861px): deja de comportarse como celular angosto — usa una
           columna más ancha y el scroll natural de la página en vez de la caja
           fija de 680px. */
        /* width:100% es la parte que arregla el ancho inconsistente entre
           pantallas: sin esto, al ser hijo de un flex en fila (el <main> de
           page.js), el shell se "encogía" al ancho de su contenido más angosto
           en cada pantalla (Crear/Perfil con poco contenido quedaban delgados,
           Feed con carruseles de imágenes quedaba ancho) — y la barra inferior,
           al ser hija del shell, heredaba ese ancho variable. Con width:100%
           el shell siempre ocupa su max-width completo, igual en las 4 pantallas. */
        /* Antes .qs-mid tenía su propio scroll interno (max-height + overflow-y)
           mientras .qs-shell (su padre) NO tenía altura ni overflow propios, así
           que además del scroll interno del feed, la página entera podía crecer
           y desplazarse hasta que la barra inferior (sticky, pero sin un
           contenedor con overflow del que "colgarse") quedaba a la vista: dos
           scrolls compitiendo. Ahora .qs-shell fija su alto al del teléfono
           (100dvh) y es un flex column de una sola columna: el body scrollea
           SOLO dentro de .qs-mid (flex:1) y BottomNav queda como último item,
           siempre visible al fondo, sin position:fixed ni scroll duplicado. */
        /* NAV INFERIOR: antes, en pantallas que no son el mapa, BottomNav era
           un hijo normal del flex-column (después de .qs-mid) — es decir,
           quedaba DENTRO del flujo, empujando/recortando el alto de .qs-mid
           en vez de flotar encima. Eso es lo que hacía que se comportara
           distinto entre Feed y Descubrir. Se intentó resolver con
           position:absolute anclada a .qs-mid, pero esa combinación depende
           de que .qs-shell (definida fuera de este archivo) resuelva su alto
           real de forma consistente — en producción esto hacía que la nav
           quedara más arriba del borde inferior en Feed/Landing/Perfil,
           mientras que en el mapa (que ya usa position:fixed en
           .qs-map-nav-wrap, ver abajo) sí quedaba pegada al borde real de
           pantalla. Ahora, en MÓVIL, .qs-nav-wrap también usa position:fixed
           anclada directo al viewport — la misma técnica que ya funciona en
           el mapa — así todas las pantallas comparten la misma posición
           vertical de la nav, sin depender de ningún contenedor intermedio.
           .qs-mid sigue con su padding-bottom para que el contenido real no
           quede tapado detrás de la nav.
           En DESKTOP (>=861px) se mantiene el comportamiento actual: la nav
           vuelve a quedar en flujo normal al final del contenido, sin overlay
           ni scroll de página distinto al de siempre — el mapa es la única
           excepción, porque en desktop también es fullscreen a propósito. */
        .qs-nav-wrap { position: fixed; left: 0; right: 0; bottom: 0; z-index: 1400; }
        /* Barra inferior específica de la pantalla de mapa (móvil): usa el
           mismo position:fixed que .qs-nav-wrap arriba, anclada directo al
           viewport (no a ningún contenedor flex intermedio). El fondo
           sólido y el padding de safe-area-inset-bottom ya están en el
           propio BottomNav (sin cambios ahí). */
        .qs-map-nav-wrap { position: fixed; left: 0; right: 0; bottom: 0; z-index: 1400; }
        .qs-mid { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; padding-bottom: 84px; }
        /* Solo para Landing: la convierte en un flex-column de un solo hijo
           (el div que devuelve Landing()) con justify-content:center, así el
           bloque texto+botones(+vitrina) queda centrado verticalmente dentro
           del alto REAL ya disponible de .qs-mid (que ya descuenta el espacio
           de la nav flotante vía su padding-bottom) — sin que Landing tenga
           que declarar ningún height/minHeight en porcentaje. Esto evita el
           problema anterior: un height:"100%" en un hijo, dentro de una
           cadena de contenedores con flex-grow + overflow:auto, no siempre
           resuelve el porcentaje de forma consistente entre navegadores (por
           eso el resultado quedaba pegado arriba pese al justifyContent en
           el propio Landing). Centrar desde el PADRE con altura ya resuelta
           (.qs-mid) es la forma robusta de conseguirlo. */
        /* min-height:100dvh (además de justify-content:center) es el mismo
           respaldo que ya existía solo para desktop más abajo: así el
           centrado de Landing no depende de que .qs-shell (definida fuera
           de este archivo) resuelva su alto de forma consistente en todos
           los navegadores — con este mínimo garantizado, el bloque queda
           centrado de verdad también en móvil. */
        .qs-landing-center { display: flex; flex-direction: column; justify-content: center; min-height: 100dvh; }
        /* Panel de Feed/Actividad/Crear en MÓVIL (clase qs-shell-wide, ver
           arriba): antes tenía un margen de 12px a cada lado, que dejaba el
           panel (y su barra inferior, que desde el cambio anterior comparte
           esta misma clase) más angosto que Descubrir/Perfil. Ahora usa el
           mismo truco "full bleed" que ya usa .qs-shell-full más abajo
           (width:100vw + margin izq/der negativo con calc(50% - 50vw)) para
           llegar exactamente al mismo ancho que esas dos pantallas — solo se
           mantiene el border-radius superior y el display:flex que Feed/
           Actividad necesitan para su layout interno (header + scroll + nav).
           No toca Landing ni Guardados porque esas pantallas no llevan esta
           clase. */
        @media (max-width: 860px) {
          .qs-shell.qs-shell-wide { width: 100vw; margin: 0 calc(50% - 50vw); max-width: none; flex: 1 1 auto; height: 100dvh; border-radius: 22px 22px 0 0; display: flex; flex-direction: column; }
          /* Se probó una clase .qs-nav-wrap-inset con left/right:12px acá, pero
             asumía que position:fixed en .qs-nav-wrap se resuelve contra el
             viewport real — igual que .qs-shell-wide definía su margen de
             12px en ese momento. Si en realidad se resuelve contra otro
             contenedor (algo fuera de este archivo, ver comentario junto a
             .qs-nav-wrap más arriba), ese inset se sumaba al margen del panel
             en vez de igualarlo, empeorando el desalineado. Se reemplazó por
             el mismo truco ya usado en el mapa: envolver la nav en un
             .qs-shell real, así hereda el ancho/posición EXACTOS del panel
             sin depender de esa suposición — ver el render de la nav más
             abajo en este archivo. */
          /* Perfil (clase qs-shell-full): a diferencia de Feed/Actividad,
             acá el pedido es ancho completo y SIN margen en ningún lado —
             ni lateral ni superior. El panel tiene position:relative (fijado
             por estilo inline, que siempre gana sobre esta clase), así que
             left/right/top NO sirven para estirarlo de borde a borde —solo
             lo desplazarían dentro de su posición normal—. Lo que sí
             funciona con position:relative es el truco estándar de "full
             bleed": width:100vw + margin izquierdo/derecho negativo
             (calc(50% - 50vw)), que rompe cualquier margen/padding del
             padre y lo estira al viewport real sin depender de ese CSS
             externo. margin-top queda en 0 en el mismo shorthand. Abajo
             sigue en 0 (pegado a la barra, ya fija). Solo las esquinas
             superiores quedan redondeadas. */
          .qs-shell.qs-shell-full { width: 100vw; margin: 0 calc(50% - 50vw); height: 100dvh; border-radius: 22px 22px 0 0; }
          /* Landing (clase qs-shell-rounded): a diferencia de Feed/Actividad/
             Perfil, acá SOLO se toca border-radius — nada de margin, width
             ni height, porque el centrado de Landing ya funciona bien (vía
             .qs-landing-center) y no hay que tocarlo. La causa de las
             esquinas puntiagudas: shellStyle (inline, en este mismo
             archivo) nunca define borderRadius para pantallas sin mapa, así
             que en móvil ese valor depende por completo de la regla base
             .qs-shell externa a este archivo — que aquí no se ve que defina
             ningún radio para mobile (solo el media query de desktop, más
             abajo, sí lo hace). Como Landing es la única pantalla sin mapa
             que no lleva ninguna clase modificadora propia, se quedaba sin
             ese redondeo. Esta regla mínima soluciona solo eso. */
          .qs-shell.qs-shell-rounded { border-radius: 22px 22px 0 0; }
        }
        @media (min-width: 861px) {
          .qs-shell { max-width: 640px; border-radius: 20px; height: auto; max-height: none; display: block; }
          .qs-mid { flex: none; overflow-y: visible; overflow-x: visible; padding-bottom: 0; }
          .qs-nav-wrap { position: static; z-index: auto; }
          /* Mismo comportamiento de escritorio que .qs-nav-wrap: en laptop
             el mapa ya es fullscreen "a propósito" (ver comentario arriba),
             y la barra vuelve a su posición estática de siempre — no cambia
             nada del comportamiento actual en desktop. */
          .qs-map-nav-wrap { position: static; z-index: auto; }
          /* En desktop .qs-mid deja de tener alto propio (flex:none), así que
             el centrado de la Landing necesita un alto de referencia propio:
             el del viewport menos el margen del marco. Sin esto, la portada
             quedaba pegada arriba en laptop. El resto de pantallas no usa
             esta clase, así que nada más cambia. */
          .qs-landing-center { display: flex; flex-direction: column; justify-content: center; min-height: calc(100dvh - 96px); }
        }
      `}</style>
      <Toast text={toast} />
      <div style={midStyle} className={midClassName}>
        {body}
        {shareState && <ShareSheet plan={shareState.plan} mode={shareState.mode} onClose={() => setShareState(null)} onToast={(t) => showToast(t)} />}
        {commentsState && <CommentsSheet plan={commentsState.plan} onClose={() => setCommentsState(null)} onToast={(t) => showToast(t)} onCommentPosted={bumpCommentCount} />}
        {/* La nav vive DENTRO del contenedor de contenido para poder flotar sobre
            él en móvil. Antes, para Feed/Actividad/Perfil, se asumía que
            .qs-nav-wrap (position:fixed) ya "heredaba" el ancho del panel por
            estar anidada dentro de .qs-mid/.qs-shell — pero position:fixed se
            calcula contra su containing block real (el viewport, o un
            ancestro con transform si lo hay fuera de este archivo), NO contra
            el ancho visual del padre en el árbol. Esa suposición era la causa
            de que la barra quedara desalineada del panel en Feed. La solución
            ya existía para el mapa (ver .qs-map-nav-wrap): envolver la nav en
            un .qs-shell real, con las MISMAS clases modificadoras que usa el
            panel de esa pantalla (qs-shell-wide para Feed/Actividad,
            qs-shell-full para Perfil), para que herede exactamente su mismo
            ancho/margen/posición sin depender de esa suposición. Se
            sobreescriben height/maxHeight/display inline (igual que en el
            mapa) para que el envoltorio no intente tomar el alto completo del
            panel — solo su ancho y posición horizontal. BottomNav en sí no
            cambia: solo cambia el contenedor que la envuelve. */}
        {showNav && (
          isMapScreen ? (
            <div className="qs-map-nav-wrap">
              <div className="qs-shell" style={{ height: "auto", maxHeight: "none", display: "block" }}>
                <BottomNav current={current.screen} onNav={navBottom} />
              </div>
            </div>
          ) : (
            <div className="qs-nav-wrap">
              <div className={shellClassName} style={{ height: "auto", maxHeight: "none", display: "block", border: "none" }}>
                <BottomNav current={current.screen} onNav={navBottom} />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );

  // La pantalla de mapa se renderiza directamente en document.body en vez de en su
  // lugar normal dentro del árbol de React. Es lo que de verdad garantiza el
  // fullscreen: si algún contenedor padre (en layout.jsx/page.jsx, que no vemos
  // desde acá) tiene un transform, overflow o filter aplicado, "position:fixed"
  // deja de ser relativo a la ventana del navegador y pasa a serlo a ESE padre —
  // eso es lo que hacía que el buscador/chips/tarjeta quedaran fuera de la parte
  // visible hasta reducir el zoom. El portal evita depender de eso por completo.
  // Las demás pantallas (Feed, Crear, Actividad, Perfil) NO usan portal y siguen
  // renderizándose exactamente igual que siempre, en su lugar normal.
  if (isMapScreen && typeof document !== "undefined") {
    return createPortal(shell, document.body);
  }
  return shell;
}
