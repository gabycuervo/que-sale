"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * Contexto de autenticación para "¿Qué sale?".
 *
 * Responsabilidades:
 * - Detectar la sesión actual al cargar la app (y mantenerla al recargar,
 *   ya que @supabase/supabase-js persiste la sesión en localStorage por defecto).
 * - Escuchar cambios de sesión (login, logout, refresh de token) en tiempo real.
 * - Cargar el perfil correspondiente desde la tabla `profiles` (ya existente,
 *   con su trigger de creación automática) para el usuario autenticado.
 * - Exponer signUp / signIn / signOut y estados de carga/error listos para la UI.
 *
 * No crea tablas ni modifica `profiles`/`plans`. Solo lee de `profiles`.
 */

const AuthContext = createContext(undefined);

function mapAuthError(error) {
  const msg = error?.message || "";
  if (msg.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (msg.includes("User already registered")) return "Ya existe una cuenta con este correo.";
  if (msg.includes("Password should be at least")) return "La contraseña debe tener al menos 6 caracteres.";
  if (msg.includes("Unable to validate email address")) return "El correo ingresado no es válido.";
  if (msg.includes("Email not confirmed")) return "Debes confirmar tu correo antes de iniciar sesión.";
  if (msg.toLowerCase().includes("rate limit")) return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return "No se pudo conectar. Revisa tu conexión a internet.";
  return msg || "Ocurrió un error inesperado. Inténtalo de nuevo.";
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true); // chequeo inicial de sesión (para evitar parpadeos/flash)
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) {
        console.error("[Auth] Error cargando perfil:", error.message);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1) Sesión actual (funciona también justo después de recargar la página,
    //    porque el cliente de Supabase persiste la sesión en localStorage).
    // IMPORTANTE: si esta promesa llegara a rechazar (red caída, storage
    // corrupto, etc.) el catch asegura que `loading` igual se libere, para
    // que la pestaña Perfil nunca quede bloqueada en "Verificando sesión…".
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[Auth] Error obteniendo la sesión:", error.message);
          setSession(null);
          setUser(null);
          return;
        }
        const currentSession = data?.session ?? null;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          fetchProfile(currentSession.user.id);
        }
      })
      .catch((err) => {
        console.error("[Auth] Excepción obteniendo la sesión:", err);
        if (!mounted) return;
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // 2) Cambios de sesión en vivo: login, logout, refresh de token, etc.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = useCallback(async (email, password) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      const friendly = mapAuthError(error);
      setAuthError(friendly);
      return { data: null, error: friendly };
    }
    return { data, error: null };
  }, []);

  const signIn = useCallback(async (email, password) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const friendly = mapAuthError(error);
      setAuthError(friendly);
      return { data: null, error: friendly };
    }
    return { data, error: null };
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(mapAuthError(error));
    }
  }, []);

  const clearError = useCallback(() => setAuthError(null), []);
  const refreshProfile = useCallback(() => {
    if (user?.id) fetchProfile(user.id);
  }, [user, fetchProfile]);

  const value = {
    session,
    user,
    profile,
    isAuthenticated: !!user,
    loading, // true solo durante el chequeo inicial de sesión
    profileLoading,
    authError,
    signUp,
    signIn,
    signOut,
    clearError,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}
