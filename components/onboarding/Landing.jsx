import { INK, CREAM, BRAND, BRAND_DARK, BRAND_BG, LIVE, LIME, MUTED, LINE, FD, FB } from "../../lib/theme";
import React from "react";
import { Plus, Search, Users } from "lucide-react";

function Landing({ nav }) {
  // Antes esta pantalla mostraba una "vitrina" con planes reales de Supabase
  // (los 3 con más gente unida). La Landing es la portada/bienvenida de la app,
  // no una vista más de Feed: no debe mostrar planes reales, así que esa
  // vitrina se quitó por completo. Los planes reales se siguen viendo en Feed,
  // Descubrir/Mapa y Perfil exactamente igual que antes — acá no se tocó nada
  // de Supabase, solo se dejó de renderizar esa lista dentro de Landing.
  return (
    // El centrado vertical ya no se resuelve acá (un height/minHeight en % es
    // frágil quando el padre lo da vía flex-grow + overflow:auto — por eso el
    // intento anterior no centraba de verdad). Ahora .qs-mid (el padre directo,
    // ver clase .qs-landing-center) es el que centra este bloque completo con
    // justify-content, así que este div solo necesita su alto natural de
    // contenido.
    <div style={{ background: CREAM }}>
      <div style={{ padding: "24px 24px 8px" }}>
        {/* Antes acá se repetía casi la misma frase dos veces ("¿Qué sale?" +
            "¿Qué sale hoy?"), y esa segunda línea es exactamente el titular que
            ya usa el Feed — hacía que Landing se sintiera como otra copia del
            Feed en vez de una portada aparte. Ahora el wordmark es solo la marca
            (chico, un logo) y el titular grande dice otra cosa: la propuesta de
            valor, no un eco del Feed. */}
        <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 16, color: BRAND, margin: "0 0 18px", letterSpacing: 0.2 }}>¿QUÉ SALE?</p>
        <h1 style={{ fontFamily: FD, fontWeight: 700, fontSize: 42, lineHeight: 1.1, color: INK, margin: "0 0 16px" }}>Encuentra tu<br />próximo plan 👀</h1>
        <p style={{ fontFamily: FB, fontSize: 16.5, color: MUTED, margin: "0 0 28px", lineHeight: 1.5 }}>Descubre qué está pasando cerca de ti ahora mismo y con quién hacerlo.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <button onClick={() => nav("feed")} style={{ border: "none", background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`, color: "white", fontFamily: FB, fontWeight: 700, fontSize: 17, padding: 18, borderRadius: 16, cursor: "pointer" }}>Ver qué sale</button>
          <button onClick={() => nav("create")} style={{ border: `1.5px solid ${INK}`, background: "transparent", color: INK, fontFamily: FB, fontWeight: 700, fontSize: 17, padding: 18, borderRadius: 16, cursor: "pointer" }}>Crear mi primer plan</button>
        </div>
      </div>
    </div>
  );
}

export { Landing };
