"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, LogOut, MapPin, Pencil, Camera, Settings as SettingsIcon, Mail, Sparkles } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabaseClient";
import AccountSettings from "./AccountSettings";
import { CAT_COLORS, CAT_EMOJI } from "../lib/categories";
import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, MUTED, LINE, FD, FB } from "../lib/theme";

export default function MyAccountProfile({ onBack }) {
  const { user, profile, profileLoading, signOut, refreshProfile } = useAuth();
  // "profile" | "settings": Ajustes vive como una subvista de Perfil, sin tocar
  // el screen-stack global de QueSaleApp.jsx (current.screen sigue en "profile").
  const [view, setView] = useState("profile");
  const [tab, setTab] = useState("planes"); // "planes" | "intereses" | "sobre-mi"
  const [signingOut, setSigningOut] = useState(false);
  const fileInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [formError, setFormError] = useState(null);

  // "Mis planes" reales: los que creé (public.plans) y cuántos totales tengo con
  // participación (public.plan_participants, incluye los propios por la
  // auto-participación del creador). Sin datos mock: si Supabase falla, se
  // muestra un estado de error con reintento en vez de inventar números.
  const [myPlans, setMyPlans] = useState([]);
  const [myPlansLoading, setMyPlansLoading] = useState(true);
  const [myPlansError, setMyPlansError] = useState(null);
  const [attendedCount, setAttendedCount] = useState(null);

  // Seguidores/seguidos reales de public.follows (misma tabla y mismo conteo
  // que ya usa CreatorProfile para perfiles de otras personas).
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const loadFollowCounts = useCallback(async () => {
    if (!user) {
      setFollowerCount(0);
      setFollowingCount(0);
      return;
    }
    try {
      const { count: followers, error: followersError } = await supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", user.id);
      if (followersError) console.error("[Follows] Error contando seguidores:", followersError.message);
      setFollowerCount(followers ?? 0);

      const { count: following, error: followingError } = await supabase
        .from("follows")
        .select("following_id", { count: "exact", head: true })
        .eq("follower_id", user.id);
      if (followingError) console.error("[Follows] Error contando seguidos:", followingError.message);
      setFollowingCount(following ?? 0);
    } catch (e) {
      // Nunca dejamos que un fallo de red o de la tabla "follows" (por ejemplo si
      // todavía no se ejecutó el SQL del Bloque 2 en este entorno) tumbe la
      // pantalla entera: sin este catch, una excepción acá quedaba sin atrapar
      // dentro del useEffect y Next.js la mostraba como "client-side exception".
      console.error("[Follows] Excepción cargando seguidores/seguidos:", e);
      setFollowerCount(0);
      setFollowingCount(0);
    }
  }, [user]);

  useEffect(() => { loadFollowCounts(); }, [loadFollowCounts]);

  const loadMyPlans = useCallback(async () => {
    if (!user) {
      setMyPlans([]);
      setAttendedCount(null);
      setMyPlansLoading(false);
      return;
    }
    setMyPlansLoading(true);
    setMyPlansError(null);

    const { data: createdRows, error: createdError } = await supabase
      .from("plans")
      .select("id, title, category, photo_url, starts_at")
      .eq("creator_id", user.id)
      .order("starts_at", { ascending: false });

    if (createdError) {
      console.error("[Profile] Error cargando mis planes:", createdError.message);
      setMyPlansError("No pudimos cargar tus planes.");
      setMyPlansLoading(false);
      return;
    }

    const { count, error: attendedError } = await supabase
      .from("plan_participants")
      .select("plan_id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (attendedError) {
      console.error("[Profile] Error contando planes asistidos:", attendedError.message);
    }

    setMyPlans(createdRows || []);
    setAttendedCount(attendedError ? null : count ?? 0);
    setMyPlansLoading(false);
  }, [user]);

  useEffect(() => { loadMyPlans(); }, [loadMyPlans]);

  const handleLogout = async () => {
    setSigningOut(true);
    await signOut();
    // Al cerrar sesión, onAuthStateChange limpia user/profile y QueSaleApp
    // vuelve a mostrar la pantalla de login automáticamente.
    setSigningOut(false);
  };

  // Sube el archivo elegido a Storage (bucket "avatars", carpeta = user.id, tal
  // como lo exige la policy RLS) y guarda la URL pública en profiles.avatar_url.
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo más adelante
    if (!file || !user) return;

    setAvatarUploading(true);
    setFormError(null);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      console.error("[Profile] Error subiendo avatar:", uploadError.message);
      setFormError("No pudimos subir la foto. Intenta de nuevo.");
      setAvatarUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
    // Cache-bust: el mismo path se reutiliza al cambiar de foto (upsert), así que
    // sin esto el navegador podría seguir mostrando la imagen anterior en caché.
    const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);

    if (updateError) {
      console.error("[Profile] Error guardando avatar_url:", updateError.message);
      setFormError("Subimos la foto pero no pudimos guardarla en tu perfil. Intenta de nuevo.");
      setAvatarUploading(false);
      return;
    }

    await refreshProfile();
    setAvatarUploading(false);
  };

  const startEditing = () => {
    setFormDisplayName(profile?.display_name || "");
    setFormUsername(profile?.username || "");
    setFormError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setFormError(null);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    setFormError(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: formDisplayName.trim() || null,
        username: formUsername.trim() || null,
      })
      .eq("id", user.id);

    if (error) {
      console.error("[Profile] Error guardando perfil:", error.message);
      setFormError(error.code === "23505" ? "Ese nombre de usuario ya está en uso." : "No pudimos guardar los cambios. Intenta de nuevo.");
      setSavingProfile(false);
      return;
    }

    await refreshProfile();
    setSavingProfile(false);
    setEditing(false);
  };

  const displayName = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "Tu perfil";
  const interestsList = Array.isArray(profile?.interests) ? profile.interests.filter(Boolean) : [];

  if (view === "settings") {
    return <AccountSettings onBack={() => setView("profile")} />;
  }

  const statCard = { flex: 1, textAlign: "center" };
  const statNum = { fontFamily: FD, fontWeight: 700, fontSize: 18, margin: 0, color: INK };
  const statLabel = { fontFamily: FB, fontWeight: 700, fontSize: 10.5, margin: "2px 0 0", color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 };

  return (
    <div
      style={{
        background: CREAM,
        height: "100dvh",
        minHeight: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        boxSizing: "border-box",
      }}
    >
      {/* Header flotante sobre el degradado de portada, en vez de una barra blanca
          plana separada del contenido — mismo tratamiento "hero" que ya usa el
          Feed (BRAND → BRAND_DARK), para que Perfil se sienta parte de la misma
          app y no una pantalla de ajustes aparte. */}
      <div style={{ position: "relative", background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 75%)`, padding: "14px 16px 56px", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.10)", top: -60, right: -30, pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
          <button onClick={onBack} style={{ border: "none", background: "rgba(255,255,255,.2)", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ChevronLeft size={19} color="white" />
          </button>
          <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 16, margin: 0, color: "white", flex: 1 }}>Perfil</p>
          <button onClick={() => setView("settings")} aria-label="Ajustes" style={{ border: "none", background: "rgba(255,255,255,.2)", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <SettingsIcon size={17} color="white" />
          </button>
        </div>
      </div>

      {/* La tarjeta de identidad se superpone al degradado (margin-top negativo),
          como en las apps sociales modernas: foto grande, nombre, @usuario. */}
      <div style={{ padding: "0 20px 24px", textAlign: "center", marginTop: -46 }}>
        <div style={{ margin: "0 auto 12px", position: "relative", width: 92, display: "inline-block" }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 92, height: 92, borderRadius: "50%", objectFit: "cover", margin: "0 auto", display: "block", border: `4px solid ${CREAM}`, boxShadow: "0 6px 16px rgba(22,21,32,.18)" }} />
          ) : (
            <div style={{ width: 92, height: 92, borderRadius: "50%", background: BRAND, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: FD, fontWeight: 700, fontSize: 34, margin: "0 auto", border: `4px solid ${CREAM}`, boxShadow: "0 6px 16px rgba(22,21,32,.18)" }}>
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          <button onClick={() => fileInputRef.current?.click()} disabled={avatarUploading} aria-label="Cambiar foto de perfil" style={{ position: "absolute", bottom: 2, right: 0, width: 30, height: 30, borderRadius: "50%", border: `3px solid ${CREAM}`, background: BRAND, display: "flex", alignItems: "center", justifyContent: "center", cursor: avatarUploading ? "default" : "pointer" }}>
            <Camera size={13} color="white" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarFileChange} style={{ display: "none" }} />
        </div>
        {avatarUploading && <p style={{ fontFamily: FB, fontSize: 12, color: MUTED, margin: "0 0 8px" }}>Subiendo foto…</p>}

        {editing ? (
          <div style={{ margin: "0 0 14px", textAlign: "left" }}>
            <label style={{ fontFamily: FB, fontSize: 12, color: MUTED, display: "block", margin: "0 0 4px" }}>Nombre visible</label>
            <input
              value={formDisplayName}
              onChange={(e) => setFormDisplayName(e.target.value)}
              placeholder="Tu nombre"
              style={{ width: "100%", fontFamily: FB, fontSize: 14, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${LINE}`, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
            />
            <label style={{ fontFamily: FB, fontSize: 12, color: MUTED, display: "block", margin: "0 0 4px" }}>Usuario</label>
            <input
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              placeholder="usuario"
              style={{ width: "100%", fontFamily: FB, fontSize: 14, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${LINE}`, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
            />
            {formError && <p style={{ fontFamily: FB, fontSize: 12.5, color: "#D64545", margin: "0 0 10px" }}>{formError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveProfile} disabled={savingProfile} style={{ flex: 1, border: "none", background: BRAND, color: "white", fontFamily: FB, fontWeight: 700, fontSize: 13.5, padding: 12, borderRadius: 12, cursor: savingProfile ? "default" : "pointer" }}>
                {savingProfile ? "Guardando…" : "Guardar"}
              </button>
              <button onClick={cancelEditing} disabled={savingProfile} style={{ flex: 1, border: `1.5px solid ${LINE}`, background: "transparent", color: INK, fontFamily: FB, fontWeight: 700, fontSize: 13.5, padding: 12, borderRadius: 12, cursor: savingProfile ? "default" : "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 19, color: INK, margin: "0 0 2px" }}>{displayName}</p>
            <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, margin: "0 0 10px" }}>{profile?.username ? `@${profile.username}` : user?.email}</p>
            <button onClick={startEditing} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1.5px solid ${LINE}`, background: "white", color: INK, fontFamily: FB, fontWeight: 700, fontSize: 12.5, padding: "8px 14px", borderRadius: 20, cursor: "pointer", margin: "0 0 18px", boxShadow: "0 2px 8px rgba(22,21,32,.06)" }}>
              <Pencil size={12} /> Editar perfil
            </button>
          </>
        )}

        {/* Fila única de estadísticas: SEGUIDORES · SEGUIDOS · PLANES, con datos
            reales de public.follows y public.plans (mismas consultas de siempre,
            solo reorganizadas en una sola fila en vez de dos separadas). */}
        <div style={{ display: "flex", background: "white", borderRadius: 18, border: `1px solid ${LINE}`, padding: "14px 6px", boxShadow: "0 2px 10px rgba(22,21,32,.05)", marginBottom: 18 }}>
          <div style={statCard}><p style={statNum}>{followerCount}</p><p style={statLabel}>Seguidores</p></div>
          <div style={{ width: 1, background: LINE }} />
          <div style={statCard}><p style={statNum}>{followingCount}</p><p style={statLabel}>Seguidos</p></div>
          <div style={{ width: 1, background: LINE }} />
          <div style={statCard}><p style={statNum}>{myPlansLoading ? "…" : myPlans.length}</p><p style={statLabel}>Planes</p></div>
        </div>

        {/* Biografía: solo se muestra si existe de verdad en profiles.bio — sin
            texto de relleno inventado cuando está vacía. */}
        <div style={{ textAlign: "left", marginBottom: 18 }}>
          <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 11.5, color: INK, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 0.4 }}>Biografía</p>
          {profileLoading ? (
            <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, margin: 0 }}>Cargando…</p>
          ) : profile?.bio ? (
            <p style={{ fontFamily: FB, fontSize: 13.5, color: INK, margin: 0, lineHeight: 1.5 }}>{profile.bio}</p>
          ) : (
            <p style={{ fontFamily: FB, fontSize: 13, color: MUTED, margin: 0, fontStyle: "italic" }}>Todavía no agregaste una biografía.</p>
          )}
        </div>
      </div>

      {/* Navegación de 3 pestañas: Planes / Intereses / Sobre mí */}
      <div style={{ display: "flex", padding: "0 20px", gap: 6, borderBottom: `1.5px solid ${LINE}` }}>
        {[
          { k: "planes", label: "Planes" },
          { k: "intereses", label: "Intereses" },
          { k: "sobre-mi", label: "Sobre mí" },
        ].map((t) => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                flex: 1, border: "none", background: "none", cursor: "pointer",
                padding: "0 0 10px", fontFamily: FB, fontWeight: 700, fontSize: 12.5,
                color: active ? BRAND_DARK : MUTED,
                borderBottom: active ? `2.5px solid ${BRAND}` : "2.5px solid transparent",
                marginBottom: -1.5,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "18px 20px calc(96px + env(safe-area-inset-bottom, 0px))" }}>
        {tab === "planes" && (
          <>
            {myPlansLoading && <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "4px 0 20px" }}>Cargando tus planes…</p>}

            {!myPlansLoading && myPlansError && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: FB, fontSize: 12.5, color: MUTED, margin: "0 0 8px" }}>{myPlansError}</p>
                <button onClick={loadMyPlans} style={{ border: "none", background: BRAND, color: "white", fontFamily: FB, fontWeight: 700, fontSize: 12.5, padding: "8px 16px", borderRadius: 10, cursor: "pointer" }}>
                  Reintentar
                </button>
              </div>
            )}

            {!myPlansLoading && !myPlansError && myPlans.length === 0 && (
              <div style={{ textAlign: "center", padding: "30px 14px", background: "white", border: `1.5px dashed ${LINE}`, borderRadius: 18 }}>
                <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 13.5, color: INK, margin: "0 0 4px" }}>Todavía no has creado planes</p>
                <p style={{ fontFamily: FB, fontSize: 12, color: MUTED, margin: 0 }}>Cuando crees uno, aparecerá aquí como tarjeta. 👀</p>
              </div>
            )}

            {!myPlansLoading && !myPlansError && myPlans.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {myPlans.map((p) => {
                  const color = CAT_COLORS[p.category] || BRAND;
                  return (
                    <div key={p.id} style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 3px 12px rgba(22,21,32,.08)", background: "white" }}>
                      <div style={{ position: "relative", height: 92, background: p.photo_url ? `#eee url(${p.photo_url}) center/cover no-repeat` : `${color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {!p.photo_url && <span style={{ fontSize: 30 }}>{CAT_EMOJI[p.category] || "📍"}</span>}
                        {p.category && (
                          <span style={{ position: "absolute", top: 8, left: 8, fontFamily: FB, fontWeight: 700, fontSize: 9.5, color: "white", background: `${color}CC`, padding: "3px 9px", borderRadius: 20 }}>
                            {p.category}
                          </span>
                        )}
                      </div>
                      <p style={{ fontFamily: FB, fontWeight: 700, fontSize: 12, color: INK, margin: 0, padding: "8px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "intereses" && (
          <>
            {interestsList.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {interestsList.map((i) => (
                  <span key={i} style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: BRAND_DARK, background: BRAND_BG, padding: "8px 14px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {CAT_EMOJI[i] || "💜"} {i}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "30px 14px", background: "white", border: `1.5px dashed ${LINE}`, borderRadius: 18 }}>
                <Sparkles size={20} color={MUTED} style={{ marginBottom: 6 }} />
                <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 13.5, color: INK, margin: "0 0 4px" }}>Todavía no elegiste intereses</p>
                <p style={{ fontFamily: FB, fontSize: 12, color: MUTED, margin: 0 }}>Se guardan desde "¿Qué te late?" al crear tu primer plan.</p>
              </div>
            )}
          </>
        )}

        {tab === "sobre-mi" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "white", border: `1px solid ${LINE}`, borderRadius: 14, padding: 13 }}>
              <Mail size={15} color={MUTED} />
              <p style={{ fontFamily: FB, fontSize: 13, color: INK, margin: 0 }}>{user?.email || "—"}</p>
            </div>
            {profile?.city && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "white", border: `1px solid ${LINE}`, borderRadius: 14, padding: 13 }}>
                <MapPin size={15} color={MUTED} />
                <p style={{ fontFamily: FB, fontSize: 13, color: INK, margin: 0 }}>{profile.city}</p>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "white", border: `1px solid ${LINE}`, borderRadius: 14, padding: 13 }}>
              <Sparkles size={15} color={MUTED} />
              <p style={{ fontFamily: FB, fontSize: 13, color: INK, margin: 0 }}>
                {myPlansLoading ? "…" : `${myPlans.length} plan${myPlans.length === 1 ? "" : "es"} creado${myPlans.length === 1 ? "" : "s"}`}
                {attendedCount != null && ` · ${attendedCount} asistido${attendedCount === 1 ? "" : "s"}`}
              </p>
            </div>
            {!profile?.city && !profile?.bio && interestsList.length === 0 && (
              <p style={{ fontFamily: FB, fontSize: 12, color: MUTED, margin: "4px 2px 0", fontStyle: "italic" }}>Todavía no completaste más información en tu perfil.</p>
            )}
          </div>
        )}

        <button
          onClick={handleLogout}
          disabled={signingOut}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", border: `1.5px solid ${INK}`, background: "transparent", color: INK, fontFamily: FB, fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 14, cursor: signingOut ? "default" : "pointer", marginTop: 26 }}
        >
          <LogOut size={16} /> {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </div>
  );
}
