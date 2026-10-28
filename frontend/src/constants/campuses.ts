export type CampusId =
  | "campus_centro"
  | "campus_saude"
  | "campus_olimpico"
  | "campus_vale"
  | "campus_agronomia"
  | "campus_litoral_norte";

export interface CampusInfo {
  id: CampusId;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
}

export const CAMPUS_LIST: CampusInfo[] = [
  { id: "campus_centro", name: "Campus Centro", shortName: "Centro", lat: -30.0349, lng: -51.2177 },
  { id: "campus_saude", name: "Campus Saúde", shortName: "Saúde", lat: -30.0395, lng: -51.2089 },
  { id: "campus_olimpico", name: "Campus Olímpico (ESEFID)", shortName: "Olímpico (ESEFID)", lat: -30.0538, lng: -51.1789 },
  { id: "campus_vale", name: "Campus do Vale", shortName: "Vale", lat: -30.0734, lng: -51.1201 },
  { id: "campus_agronomia", name: "Campus Agronomia", shortName: "Agronomia", lat: -30.0664, lng: -51.1378 },
  { id: "campus_litoral_norte", name: "Campus Litoral Norte", shortName: "Litoral Norte", lat: -29.9794, lng: -50.133 },
];

export const CAMPUS_BY_ID: Record<CampusId, CampusInfo> = Object.fromEntries(
  CAMPUS_LIST.map((c) => [c.id, c])
) as Record<CampusId, CampusInfo>;

export const DEFAULT_CAMPUS_ID: CampusId = "campus_centro";
export const DEFAULT_CAMPUS = CAMPUS_BY_ID[DEFAULT_CAMPUS_ID];

export const CAMPUS_COORDS: Record<CampusId, [number, number]> = Object.fromEntries(
  CAMPUS_LIST.map((c) => [c.id, [c.lat, c.lng]])
) as Record<CampusId, [number, number]>;
