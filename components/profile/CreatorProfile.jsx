import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React, { useCallback, useEffect, useState } from "react";
import { Home, Search, Plus, Bell, User, ChevronLeft, Clock, Send, Bookmark, Check, Users, Dice5, Star, X, Share2, UserPlus, MessageCircle, Link2, Instagram, Heart, UserCheck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import { Avatar } from "../ui/AppPrimitives";
import { PlanCard } from "../plans/PlanCard";
import { normalizePlanRow } from "../../lib/planUtils";

function CreatorProfile({ personId, onBack }) {
  const { user } = useAuth();
  const isSelf = !!user && user.id === personId;
  const [profile, setProfile] = useState(null);
  const [realPlans, setRealPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    let { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, bio, city, interests, profile_is_public")
      .eq("id", personId)
      .single();
    // Si `profile_is_public` (u otra columna nueva) todavía no existe en este
    // proyecto de Supabase, Postgrest devuelve un error para toda la fila en
    // vez de solo esa columna. En lugar de romper el perfil entero, se
    // reintenta sin esa columna y se trata el perfil como público por
    // defecto (mismo comportamiento que ya tiene el resto del código para
    // profile_is_public == null/undefined). No se toca SQL ni RLS.
    if (error && /column|profile_is_public/i.test(error.message || "")) {
      const retry = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, bio, city, interests")
        .eq("id", personId)
        .single();
      data = retry.data ? { ...retry.data, profile_is_public: null } : null;
      error = retry.error;
    }
    if (error) {
      console.error("[Profile] Error cargando perfil del creador:", error.message);
      setLoadError("No pudimos cargar este perfil.");
      setLoading(false);
      return;
    }
    setProfile(data);

    // Seguidores/seguidos: dos counts livianos (head:true → no trae filas, solo el total).
    const { count: followers, error: followersError } = await supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", personId);
    if (followersError) console.error("[Follows] Error contando seguidores:", followersError.message);
    setFollowerCount(followers ?? 0);

    const { count: following, error: followingError } = await supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", personId);
    if (followingError) console.error("[Follows] Error contando seguidos:", followingError.message);
    setFollowingCount(following ?? 0);

    if (user && !isSelf) {
      const { data: followRow, error: followRowError } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", personId)
        .maybeSingle();
      if (followRowError) console.error("[Follows] Error consultando si ya sigue:", followRowError.message);
      setIsFollowing(!!followRow);
    }

    // Los planes solo se muestran si el perfil es público (o si es mi propio perfil).
    // Si es privado y no soy yo, ni siquiera hace falta pedirlos.
    const isPublic = data.profile_is_public !== false;
    if (isPublic || isSelf) {
      const { data: planRows, error: plansError } = await supabase
        .from("plans")
        .select("id, title, category, photo_url, starts_at")
        .eq("creator_id", personId)
        .order("starts_at", { ascending: false })
        .limit(6);
      if (plansError) {
        console.error("[Profile] Error cargando planes del creador:", plansError.message);
        setRealPlans([]);
      } else {
        setRealPlans(planRows || []);
      }
    } else {
      setRealPlans([]);
    }

    setLoading(false);
  }, [personId, user, isSelf]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const toggleFollow = async () => {
    if (!user) return;
    if (followBusy || isSelf) return;
    const wasFollowing = isFollowing;
    setFollowBusy(true);
    // Optimista, mismo patrón que handleJoin/handleSave/handleLike en QueSaleApp.
    setIsFollowing(!wasFollowing);
    setFollowerCount((c) => Math.max(0, c + (wasFollowing ? -1 : 1)));

    if (wasFollowing) {
      const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", personId);
      if (error) {
        console.error("[Follows] Error al dejar de seguir:", error.message);
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: personId });
      if (error) {
        if (error.code === "23505") {
          // Ya existía la fila: no es un error real.
        } else {
          console.error("[Follows] Error al seguir:", error.message);
          setIsFollowing(false);
          setFollowerCount((c) => Math.max(0, c - 1));
        }
      } else {
        try {
          await supabase.from("notifications").insert({ user_id: personId, actor_id: user.id, message: "empezó a seguirte" });
        } catch (e) {
          console.error("[Follows] Error creando notificación (no bloqueante):", e);
        }
      }
    }
    setFollowBusy(false);
  };

  if (loading) return <LoadingBlock text="Cargando perfil…" />;
  if (loadError || !profile) return <ErrorBlock text={loadError || "No encontramos este perfil."} onRetry={loadProfile} />;

  const isPrivate = profile.profile_is_public === false && !isSelf;

  // Mapeo a la misma forma que ya espera Profile; los campos que no existen en
  // public.profiles (edad, likes, rating, conteo de asistidos) quedan sin definir
  // a propósito, y Profile() ya sabe ocultarlos en vez de mostrar "undefined".
  const person = {
    name: profile.display_name || profile.username || "Usuario",
    username: profile.username || null,
    avatarUrl: profile.avatar_url || null,
    color: BRAND,
    city: profile.city || "",
    bio: profile.bio || "",
    interests: profile.interests || [],
    likes: [],
    planesCreados: realPlans.length,
    realPlans,
    isPrivate,
    followerCount,
    followingCount,
    isFollowing,
    followBusy,
    onToggleFollow: user && !isSelf ? toggleFollow : null,
  };
  return <Profile person={person} onBack={onBack} mine={false} />;
}

export { CreatorProfile };
