import { CATEGORIES, CAT_EMOJI } from "./categories";

// Opciones y etiquetas compartidas por las pantallas de la app.
export const STORIES = CATEGORIES.filter((c) => c !== "Todos").map((c) => ({ key: c, emoji: CAT_EMOJI[c] }));
export const QUICK_CATS = [
  { label: "Playa", emoji: "🏖️", cat: "Playa" }, { label: "Comer", emoji: "🍔", cat: "Comida" },
  { label: "Cine", emoji: "🎬", cat: "Cine" }, { label: "Gaming", emoji: "🎮", cat: "Gaming" },
  { label: "Gym", emoji: "🏋️", cat: "Gym" }, { label: "Deporte", emoji: "⚽", cat: "Deporte" },
  { label: "Música", emoji: "🎵", cat: "Música" }, { label: "Café", emoji: "☕", cat: "Café" },
  { label: "Fotos", emoji: "📸", cat: "Fotos" }, { label: "Roadtrip", emoji: "🚗", cat: "Viajes" },
];
export const CREATE_CATS = [...QUICK_CATS, { label: "＋ Otro", emoji: "➕", cat: "otro" }];
export const WHEN_OPTIONS = [
  { key: "ahora", label: "Ahora", emoji: "⚡", bucket: "ahora" }, { key: "noche", label: "Esta noche", emoji: "🌙", bucket: "hoy" },
  { key: "mañana", label: "Mañana", emoji: "📅", bucket: "hoy" }, { key: "finde", label: "Este finde", emoji: "🔥", bucket: "finde" },
];
export const AVAILABILITY = ["Ahora", "Tardes", "Noches", "Viernes", "Sábados", "Domingos", "Fines de semana", "Variable"];
export const BOOST_OPTIONS = [
  { key: "24h", label: "24 horas", hours: 24, price: 3.9 },
  { key: "3d", label: "3 días", hours: 72, price: 6.9 },
  { key: "7d", label: "7 días", hours: 168, price: 9.9 },
];
