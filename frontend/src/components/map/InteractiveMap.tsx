/**
 * InteractiveMap Component (Leaflet + OpenStreetMap / Carto tiles)
 *
 * Provides an Uber/BlaBlaCar-style interactive map that:
 * - Adapts tile appearance automatically between Dark Mode and Light Mode
 * - Renders custom vector HTML pins (`L.divIcon`) for Origin, Destination, and Pickup
 * - Displays an anonymized privacy circle when `pickupRegionCircle` is provided (before match confirmation)
 * - Renders OSRM route geometry (`GeoJSON.LineString`) and auto-fits bounds
 * - Supports click-to-select coordinates when `onMapClick` is active
 */

import React, { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { useThemeStore } from "@/store/themeStore";

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface InteractiveMapProps {
  origin?: MapPoint | null;
  destination?: MapPoint | null;
  pickup?: MapPoint | null;
  /** When true, renders an approximate 650m privacy circle instead of an exact pin for pickup */
  pickupIsApproximate?: boolean;
  routeGeoJson?: GeoJSON.LineString | null;
  height?: string;
  interactivePickMode?: "origin" | "destination" | "pickup" | null;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

const PORTO_ALEGRE_CENTER: [number, number] = [-30.0349, -51.2177]; // Campus Centro UFRGS

function createCustomPin(color: string, badgeText: string): L.DivIcon {
  return L.divIcon({
    className: "carona-custom-pin",
    html: `
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        width:30px;
        height:30px;
        border-radius:9999px;
        background:${color};
        color:#fff;
        font-weight:700;
        font-size:12px;
        border:3px solid #ffffff;
        box-shadow:0 4px 14px rgba(0,0,0,0.45);
        transform:translate(-3px, -3px);
      ">
        ${badgeText}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const ORIGIN_ICON = createCustomPin("#10b981", "A");
const DEST_ICON = createCustomPin("#6366f1", "B");
const PICKUP_ICON = createCustomPin("#f59e0b", "P");

const MapClickHandler: React.FC<{ onMapClick?: (lat: number, lng: number) => void }> = ({
  onMapClick,
}) => {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

const BoundsUpdater: React.FC<{ points: [number, number][] }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [42, 42], maxZoom: 15, animate: true });
  }, [map, points]);

  return null;
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  origin,
  destination,
  pickup,
  pickupIsApproximate = false,
  routeGeoJson,
  height = "280px",
  interactivePickMode = null,
  onMapClick,
  className = "",
}) => {
  const { theme } = useThemeStore();

  // Convert GeoJSON [lng, lat] coordinates to Leaflet [lat, lng]
  const polylinePositions = useMemo<[number, number][]>(() => {
    if (routeGeoJson && routeGeoJson.coordinates?.length > 0) {
      return routeGeoJson.coordinates.map(([lng, lat]) => [lat, lng]);
    }
    const fallback: [number, number][] = [];
    if (origin) fallback.push([origin.lat, origin.lng]);
    if (pickup && !pickupIsApproximate) fallback.push([pickup.lat, pickup.lng]);
    if (destination) fallback.push([destination.lat, destination.lng]);
    return fallback;
  }, [routeGeoJson, origin, destination, pickup, pickupIsApproximate]);

  const boundPoints = useMemo<[number, number][]>(() => {
    if (polylinePositions.length >= 2) return polylinePositions;
    const pts: [number, number][] = [];
    if (origin) pts.push([origin.lat, origin.lng]);
    if (pickup) pts.push([pickup.lat, pickup.lng]);
    if (destination) pts.push([destination.lat, destination.lng]);
    return pts;
  }, [polylinePositions, origin, destination, pickup]);

  const cartoApiKey = (import.meta.env.VITE_CARTO_API_KEY || "").trim();

  const tileUrl = useMemo(() => {
    const keyParam = cartoApiKey ? `?key=${cartoApiKey}` : "";
    if (theme === "dark") {
      return `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png${keyParam}`;
    }
    return `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${keyParam}`;
  }, [theme, cartoApiKey]);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border ${className}`}
      style={{
        height,
        borderColor: interactivePickMode ? "var(--color-primary)" : "var(--color-border)",
      }}
    >
      {interactivePickMode && (
        <div
          className="absolute top-3 left-3 right-3 z-[500] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between shadow-lg backdrop-blur-md"
          style={{
            backgroundColor: "var(--glass-bg)",
            border: "1px solid var(--color-primary)",
            color: "var(--color-text)",
          }}
        >
          <span>
            📍 Toque em qualquer ponto do mapa para definir{" "}
            {interactivePickMode === "origin"
              ? "a Origem"
              : interactivePickMode === "destination"
              ? "o Destino"
              : "o Embarque"}
          </span>
        </div>
      )}

      <MapContainer
        center={PORTO_ALEGRE_CENTER}
        zoom={13}
        scrollWheelZoom={true}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>'
          url={tileUrl}
          subdomains="abcd"
          maxZoom={20}
        />

        <MapClickHandler onMapClick={onMapClick} />
        <BoundsUpdater points={boundPoints} />

        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#6366f1",
              weight: 5,
              opacity: 0.9,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={ORIGIN_ICON}>
            <Popup>
              <div className="text-xs">
                <strong className="block text-emerald-400">Origem (A)</strong>
                <span>{origin.label || "Ponto de partida"}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={DEST_ICON}>
            <Popup>
              <div className="text-xs">
                <strong className="block text-indigo-400">Destino (B)</strong>
                <span>{destination.label || "Ponto de chegada"}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {pickup && !pickupIsApproximate && (
          <Marker position={[pickup.lat, pickup.lng]} icon={PICKUP_ICON}>
            <Popup>
              <div className="text-xs">
                <strong className="block text-amber-400">Ponto de Encontro (P)</strong>
                <span>{pickup.label || "Embarque confirmado"}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {pickup && pickupIsApproximate && (
          <Circle
            center={[pickup.lat, pickup.lng]}
            radius={650}
            pathOptions={{
              color: "#f59e0b",
              fillColor: "#f59e0b",
              fillOpacity: 0.2,
              weight: 2,
              dashArray: "4 4",
            }}
          >
            <Popup>
              <div className="text-xs">
                <strong className="block text-amber-400">Região Aproximada</strong>
                <span>{pickup.label || "Local exato oculto até confirmação"}</span>
              </div>
            </Popup>
          </Circle>
        )}
      </MapContainer>
    </div>
  );
};
