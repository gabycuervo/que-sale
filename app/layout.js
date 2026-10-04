export const metadata = {
  title: "¿Qué sale?",
  description: "Descubre qué está pasando cerca de ti y encuentra con quién hacerlo.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
