"use client";

// Selector de ubicación real en mapa para "Crear plan". Se usa cuando la persona
// elige "📍 Elegir ubicación" en vez de "📍 Cerca de mí": permite marcar en el mapa
// el lugar donde de verdad va a ocurrir el plan (que puede no ser donde está
// físicamente en este momento). Reutiliza react-leaflet/leaflet, exactamente
// como ya hace DiscoverMap.jsx, así que no agrega ninguna dependencia nueva.
// Este archivo es independiente (no importa QueSaleApp.jsx ni es importado por
// DiscoverMap.jsx) para no crear ninguna dependencia cruzada nueva.
import { useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { INK, BRAND, LINE, MUTED, FD, FB } from "../lib/theme";

// Mismo centro por defecto que ya usa DiscoverMap.jsx (Lima, Perú) mientras la
// persona no haya tocado el mapa ni pedido su ubicación actual todavía.
const LIMA_CENTER = [-12.0464, -77.0428];

function pinIcon() {
  const html = `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;background:${BRAND};transform:rotate(-45deg);box-shadow:0 6px 14px rgba(22,21,32,.35), 0 0 0 3px white;"></div>`;
  return L.divIcon({ html, className: "qs-loc-pin", iconSize: [30, 30], iconAnchor: [15, 30] });
}

// Componente sin render propio: solo escucha clicks en el mapa y avisa la
// posición tocada. Vive dentro de <MapContainer> porque useMapEvents necesita
// el contexto del mapa de react-leaflet.
function ClickCatcher({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

// initialCoords: { lat, lng } | null — si la persona ya había elegido un punto
// antes (volvió a abrir el selector), el mapa arranca centrado ahí con el pin
// puesto, en vez de perder la selección anterior.
export default function LocationPicker({ initialCoords, onConfirm, onCancel }) {
  const [point, setPoint] = useState(initialCoords || null);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef(null);

  // Botón "usar mi ubicación actual DENTRO del selector": solo mueve el pin y
  // la cámara del mapa a la posición GPS real; la persona igual puede arrastrar/
  // tocar otro punto después si el plan es en otro lugar. No publica nada por
  // sí mismo — sigue siendo necesario tocar "Confirmar ubicación" abajo.
  const locateMe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPoint(next);
        setLocating(false);
        mapRef.current?.flyTo([next.lat, next.lng], 16, { duration: 0.6 });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: "white", display: "flex", flexDirection: "column" }}>
      {/* paddingTop con env(safe-area-inset-top): en teléfonos con notch/isla
          dinámica/esquinas redondeadas, este modal es position:fixed + inset:0,
          así que su contenido arranca pegado al borde físico real de la
          pantalla — incluida el área que tapan la cámara/notch o la barra de
          estado del sistema. Con el padding-top fijo de 14px de antes, el
          botón ✕ (que vive ahí arriba a la izquierda) quedaba parcialmente
          debajo de esa zona del sistema operativo y se veía cortado. max()
          usa 14px en teléfonos sin notch (mismo aspecto de siempre) y el
          inset real del safe-area donde exista, empujando todo el header
          (✕ + título) hacia abajo lo justo para que quede completo y visible.
          Incluido solo acá (el header), sin tocar el mapa ni el botón
          "Confirmar ubicación" de abajo. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "max(14px, env(safe-area-inset-top)) 16px 14px", borderBottom: `1px solid ${LINE}` }}>
        <button onClick={onCancel} aria-label="Cerrar" style={{ border: "none", background: LINE, borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>✕</button>
        <div>
          <p style={{ fontFamily: FD, fontWeight: 700, fontSize: 15, color: INK, margin: 0 }}>Elegir ubicación</p>
          <p style={{ fontFamily: FB, fontSize: 11.5, color: MUTED, margin: 0 }}>Toca el mapa en el lugar exacto del plan</p>
        </div>
      </div>

      <div style={{ position: "relative", flex: 1 }}>
        <MapContainer
          center={point ? [point.lat, point.lng] : LIMA_CENTER}
          zoom={point ? 16 : 12}
          style={{ height: "100%", width: "100%" }}
          ref={mapRef}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
          <ClickCatcher onPick={(lat, lng) => setPoint({ lat, lng })} />
          {point && <Marker position={[point.lat, point.lng]} icon={pinIcon()} />}
        </MapContainer>

        <button
          onClick={locateMe}
          disabled={locating}
          aria-label="Usar mi ubicación actual"
          style={{ position: "absolute", bottom: 18, right: 16, width: 46, height: 46, borderRadius: 14, border: "none", background: "white", boxShadow: "0 6px 16px rgba(22,21,32,.2)", fontSize: 19, cursor: locating ? "default" : "pointer", zIndex: 1000 }}
        >
          📍
        </button>

        {/* Atribución obligatoria de los tiles (OpenStreetMap), igual que en DiscoverMap.jsx */}
        <p style={{ position: "absolute", right: 6, bottom: 2, zIndex: 1000, margin: 0, fontFamily: FB, fontSize: 8.5, color: "rgba(22,21,32,.5)", pointerEvents: "none" }}>
          © OpenStreetMap contributors
        </p>
      </div>

      <div style={{ padding: 16, borderTop: `1px solid ${LINE}` }}>
        <button
          onClick={() => point && onConfirm(point)}
          disabled={!point}
          style={{ width: "100%", border: "none", borderRadius: 14, padding: 15, fontFamily: FB, fontWeight: 700, fontSize: 14.5, cursor: point ? "pointer" : "default", background: point ? BRAND : "#D8D2E8", color: "white" }}
        >
          {point ? "Confirmar ubicación" : "Toca el mapa para marcar el lugar"}
        </button>
      </div>
    </div>
  );
}
