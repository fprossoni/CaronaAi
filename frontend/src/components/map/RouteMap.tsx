import React, { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths (Vite issue)
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({ iconUrl, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

interface RouteMapProps {
  // Driver route as GeoJSON LineString coordinates [[lng, lat], ...]
  routeCoords?: [number, number][];
  // Pickup point [lat, lng]
  pickupPoint?: [number, number];
  // Show exact pickup or just approximate region
  showExactPickup?: boolean;
  pickupLabel?: string;
  // Campus marker [lat, lng]
  campusPoint?: [number, number];
  campusLabel?: string;
  height?: string;
}

function AutoFitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions as L.LatLngBoundsExpression, { padding: [30, 30] });
    }
  }, [map, positions]);
  return null;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  routeCoords,
  pickupPoint,
  showExactPickup = false,
  pickupLabel,
  campusPoint,
  campusLabel,
  height = "300px",
}) => {
  // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
  const leafletRoute: [number, number][] = routeCoords
    ? routeCoords.map(([lng, lat]) => [lat, lng])
    : [];

  const allPositions: [number, number][] = [
    ...leafletRoute,
    ...(pickupPoint ? [pickupPoint] : []),
    ...(campusPoint ? [campusPoint] : []),
  ];

  const center: [number, number] = campusPoint ?? [-30.0349, -51.2177]; // Porto Alegre default

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height, width: "100%", borderRadius: "12px" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {leafletRoute.length > 1 && (
        <Polyline
          positions={leafletRoute}
          pathOptions={{ color: "#6366f1", weight: 4, opacity: 0.85 }}
        />
      )}

      {campusPoint && (
        <Marker position={campusPoint}>
          <Popup>{campusLabel ?? "Campus UFRGS"}</Popup>
        </Marker>
      )}

      {pickupPoint && showExactPickup && (
        <Marker position={pickupPoint}>
          <Popup>{pickupLabel ?? "Ponto de encontro"}</Popup>
        </Marker>
      )}

      {pickupPoint && !showExactPickup && (
        <Circle
          center={pickupPoint}
          radius={500}
          pathOptions={{
            color: "#10b981",
            fillColor: "#10b981",
            fillOpacity: 0.15,
            weight: 2,
          }}
        >
          <Popup>Região aproximada de embarque</Popup>
        </Circle>
      )}

      {allPositions.length > 0 && <AutoFitBounds positions={allPositions} />}
    </MapContainer>
  );
};
