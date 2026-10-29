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
  { id: "campus_centro", name: "Campus Centro", shortName: "Centro", lat: -30.033310, lng: -51.221131 }, // ok -30.033310, -51.221131
  { id: "campus_saude", name: "Campus Saúde", shortName: "Saúde", lat: -30.043243, lng: -51.206096 }, // ok -30.043243, -51.206096
  { id: "campus_olimpico", name: "Campus Olímpico (ESEFID)", shortName: "Olímpico (ESEFID)", lat: -30.051421, lng: -51.182585 }, // ok -30.051421, -51.182585
  { id: "campus_vale", name: "Campus do Vale", shortName: "Vale", lat: -30.075477, lng: -51.124666 }, // ok -30.075477, -51.124666
  { id: "campus_agronomia", name: "Campus Agronomia", shortName: "Agronomia", lat: -30.069883, lng: -51.142024 }, // ok -30.069883, -51.142024
  { id: "campus_litoral_norte", name: "Campus Litoral Norte", shortName: "Litoral Norte", lat: -29.971383, lng: -50.226691 }, // ok -29.971383, -50.226691
];

export const CAMPUS_BY_ID: Record<CampusId, CampusInfo> = Object.fromEntries(
  CAMPUS_LIST.map((c) => [c.id, c])
) as Record<CampusId, CampusInfo>;

export const DEFAULT_CAMPUS_ID: CampusId = "campus_centro";
export const DEFAULT_CAMPUS = CAMPUS_BY_ID[DEFAULT_CAMPUS_ID];

export const CAMPUS_COORDS: Record<CampusId, [number, number]> = Object.fromEntries(
  CAMPUS_LIST.map((c) => [c.id, [c.lat, c.lng]])
) as Record<CampusId, [number, number]>;
