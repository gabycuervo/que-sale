"use client";

import dynamic from "next/dynamic";

// QueSaleApp se carga SOLO en el navegador (ssr: false).
// Motivo: es una app totalmente interactiva basada en useState/eventos de
// usuario (sin necesidad de SEO ni de HTML pre-renderizado), por lo que
// Next.js recomienda excluirla del renderizado en servidor en vez de
// server-renderizarla y luego hidratarla.
const QueSaleApp = dynamic(() => import("../components/QueSaleApp"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#8B8798",
      }}
    >
      Cargando ¿Qué sale?…
    </div>
  ),
});

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "24px 12px",
        background: "#EFEAE0",
      }}
    >
      <QueSaleApp />
    </main>
  );
}
