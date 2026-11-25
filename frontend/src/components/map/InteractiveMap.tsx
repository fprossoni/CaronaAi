/**
 * InteractiveMap Component (Leaflet + CARTO / OSM monochrome tiles)
 *
 * Technical mobility map with architectural square pins, Signal Orange route polyline,
 * and 650m privacy circle before match confirmation.
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

const PORTO_ALEGRE_CENTER: [number, number] = [-30.0349, -51.2177];
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`;

function createCustomPin(
  bgColor: string,
  borderColor: string,
  textColor: string,
  badgeText: string
): L.DivIcon {
  return L.divIcon({
    className: "carona-custom-pin",
    html: `
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        width:28px;
        height:28px;
        border-radius:5px;
        background:${bgColor};
        color:${textColor};
        font-family:'JetBrains Mono',monospace;
        font-weight:700;
        font-size:12px;
        border:2px solid ${borderColor};
        box-shadow:0 4px 12px rgba(0,0,0,0.45);
      ">
        ${badgeText}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const ORIGIN_ICON = createCustomPin("#0b0c0d", "#fa952d", "#fa952d", "A");
const DEST_ICON = createCustomPin("#fa952d", "#0b0c0d", "#0b0c0d", "B");
const PICKUP_ICON = createCustomPin("#141619", "#f3f536", "#f3f536", "P");
const DROPOFF_ICON = createCustomPin("#141619", "#22c55e", "#22c55e", "D");

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

  const comparisonPositions = useMemo<[number, number][]>(
    () => comparisonRoute?.coordinates.map(([lng, lat]) => [lat, lng]) ?? [],
    [comparisonRoute]
  );

  const boundPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [...polylinePositions, ...comparisonPositions];
    if (origin) pts.push([origin.lat, origin.lng]);
    if (pickup) pts.push([pickup.lat, pickup.lng]);
    if (dropoff) pts.push([dropoff.lat, dropoff.lng]);
    if (destination) pts.push([destination.lat, destination.lng]);
    return pts;
  }, [polylinePositions, comparisonPositions, origin, destination, pickup, dropoff]);

  const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY?.trim();
  const cartoStyle = theme === "dark" ? "dark_all" : "light_all";
  const tileUrl = cartoApiKey
    ? `https://basemaps.cartocdn.com/rastertiles/${cartoStyle}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoApiKey)}`
    : OSM_TILE_URL;

  return (
    <div
      className={`relative rounded-[10px] overflow-hidden border ${
        interactivePickMode ? "border-primary" : "border-border"
      } ${!cartoApiKey ? "map-osm-fallback" : ""} ${className}`}
      style={{ height }}
    >
      {interactivePickMode && (
        <div className="absolute top-2.5 right-2.5 z-500 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center border border-primary bg-glass text-text shadow-md backdrop-blur-md">
          <span>
            Toque no mapa para marcar{" "}
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
          <Polyline
            positions={comparisonPositions}
            pathOptions={{ color: "#6e747e", weight: 3, dashArray: "6 8" }}
          />
        )}

        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#fa952d",
              weight: 4,
              opacity: 0.95,
              dashArray: approximateRoute ? "6 6" : undefined,
              lineCap: "square",
              lineJoin: "miter",
            }}
          />
        )}

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={ORIGIN_ICON}>
            <Popup>
              <div className="text-xs">
                <strong className="block font-mono text-accent-text">ORIGEM (A)</strong>
                <span>{origin.label || "Ponto de partida"}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={DEST_ICON}>
            <Popup>
              <div className="text-xs">
                <strong className="block font-mono text-accent-text">DESTINO (B)</strong>
                <span>{destination.label || "Ponto de chegada"}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {pickup && !pickupIsApproximate && (
          <Marker position={[pickup.lat, pickup.lng]} icon={PICKUP_ICON}>
            <Popup>
              <div className="text-xs">
                <strong className="block font-mono text-warning-text">EMBARQUE (P)</strong>
                <span>{pickup.label || "Ponto de encontro"}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={DROPOFF_ICON}>
            <Popup>
              <div className="text-xs">
                <strong className="block font-mono text-secondary">DESEMBARQUE (D)</strong>
                <span>{dropoff.label}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {pickup && pickupIsApproximate && (
          <Circle
            center={[pickup.lat, pickup.lng]}
            radius={650}
            pathOptions={{
              color: "#f3f536",
              fillColor: "#f3f536",
              fillOpacity: 0.16,
              weight: 2,
              dashArray: "4 4",
            }}
          >
            <Popup>
              <div className="text-xs">
                <strong className="block font-mono text-warning-text">BAIRRO APROXIMADO</strong>
                <span>{pickup.label || "Local exato oculto até o aceite"}</span>
              </div>
            </Popup>
          </Circle>
        )}
      </MapContainer>
    </div>
  );
};
