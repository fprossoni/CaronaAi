/**
 * InteractiveMap Component (Leaflet + OpenStreetMap / Carto tiles)
 *
 * Provides an Uber/BlaBlaCar-style interactive map that:
 * - Uses CARTO styles for dark and light mode when a key is configured
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
  dropoff?: MapPoint | null;
  comparisonRoute?: GeoJSON.LineString | null;
  approximateRoute?: boolean;
  /** When true, renders an approximate 650m privacy circle instead of an exact pin for pickup */
  pickupIsApproximate?: boolean;
  routeGeoJson?: GeoJSON.LineString | null;
  height?: string;
  scrollWheelZoom?: boolean;
  interactivePickMode?: "origin" | "destination" | "pickup" | null;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

const PORTO_ALEGRE_CENTER: [number, number] = [-30.0349, -51.2177]; // Campus Centro UFRGS
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`;

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
const DROPOFF_ICON = createCustomPin("#0e7490", "D");
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
  dropoff,
  comparisonRoute,
  approximateRoute = false,
  pickupIsApproximate = false,
  routeGeoJson,
  height = "280px",
  scrollWheelZoom = true,
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
    if (dropoff) fallback.push([dropoff.lat, dropoff.lng]);
    if (destination) fallback.push([destination.lat, destination.lng]);
    return fallback;
  }, [routeGeoJson, origin, destination, pickup, dropoff, pickupIsApproximate]);

  const comparisonPositions = useMemo<[number, number][]>(() =>
    comparisonRoute?.coordinates.map(([lng, lat]) => [lat, lng]) ?? [], [comparisonRoute]);

  const boundPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [...polylinePositions, ...comparisonPositions];
    if (origin) pts.push([origin.lat, origin.lng]);
    if (pickup) pts.push([pickup.lat, pickup.lng]);
    if (dropoff) pts.push([dropoff.lat, dropoff.lng]);
    if (destination) pts.push([destination.lat, destination.lng]);
    return pts;
  }, [polylinePositions, comparisonPositions, origin, destination, pickup, dropoff]);

  const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY?.trim();
  const cartoStyle = theme === "dark" ? "dark_all" : "voyager";
  const tileUrl = cartoApiKey
    ? `https://basemaps.cartocdn.com/rastertiles/${cartoStyle}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoApiKey)}`
    : OSM_TILE_URL;

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
            {interactivePickMode === "destination" ? "o destino" : "a origem"}
          </span>
        </div>
      )}

      <MapContainer
        center={PORTO_ALEGRE_CENTER}
        zoom={13}
        scrollWheelZoom={scrollWheelZoom}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution={cartoApiKey ? CARTO_ATTRIBUTION : OSM_ATTRIBUTION}
          url={tileUrl}
          maxNativeZoom={cartoApiKey ? 20 : 19}
          maxZoom={20}
        />

        <MapClickHandler onMapClick={onMapClick} />
        <BoundsUpdater points={boundPoints} />

        {comparisonPositions.length >= 2 && (
          <Polyline positions={comparisonPositions} pathOptions={{ color: "#64748b", weight: 4, dashArray: "6 8" }} />
        )}

        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#6366f1",
              weight: 5,
              opacity: 0.9,
              dashArray: approximateRoute ? "6 6" : undefined,
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
                <strong className="block text-amber-400">Origem do passageiro (P)</strong>
                <span>{pickup.label || "Origem confirmada"}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={DROPOFF_ICON}>
            <Popup><strong>Destino do passageiro (D)</strong><br />{dropoff.label}</Popup>
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
