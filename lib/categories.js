// Constantes de categorías compartidas entre QueSaleApp.jsx (Feed/Descubrir en grilla,
// chips, historias) y DiscoverMap.jsx (pines del mapa). Viven en su propio archivo para
// que ninguno de los dos tenga que importar al otro (eso crearía una dependencia
// circular, ya que QueSaleApp.jsx carga DiscoverMap.jsx de forma perezosa con
// next/dynamic).
export const CAT_COLORS = {
  Playa: "#FFB74D", Comida: "#FF7A59", Gym: "#7ED67A", Gaming: "#8B76FF",
  Música: "#F0679D", Viajes: "#5FA8E0", Deporte: "#3FBF9B", Fotos: "#C97DF0",
  Estudio: "#F0B23E", Cine: "#7C93E0", Café: "#B98A56",
};
export const CATEGORIES = ["Todos", "Playa", "Comida", "Gaming", "Música", "Deporte", "Cine", "Gym", "Fotos", "Viajes", "Estudio", "Café"];
export const CAT_EMOJI = { Playa: "🏖️", Comida: "🍔", Gaming: "🎮", Música: "🎵", Deporte: "⚽", Cine: "🎬", Gym: "🏋️", Fotos: "📸", Viajes: "✈️", Estudio: "📚", Café: "☕" };
