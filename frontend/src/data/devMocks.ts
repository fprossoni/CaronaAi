/**
 * Mock Fixtures for the Developer Playground (`/dev`)
 *
 * Centralizes realistic UFRGS student profiles, routes, rides, and match requests
 * so UI components and modals can be inspected and tested in complete isolation
 * without requiring multiple accounts or a running backend server.
 */

import type { UserPrivate, UserPublic } from "@/types/user";
import type { RideDetail, RidePublic } from "@/types/ride";
import type { MatchConfirmed, MatchForDriver } from "@/types/match";

// ─── Mock Users ──────────────────────────────────────────────────────────────

export const MOCK_DRIVER_USER: UserPrivate = {
  id: 9001,
  name: "Pedro Henrique Oliveira",
  email: "pedro.oliveira@inf.ufrgs.br",
  course: "Ciência da Computação",
  gender: "male",
  phone: "(51) 99876-5432",
  photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
  social_link: "@pedro.inf.ufrgs",
  bio: "Vou para o Campus do Vale toda segunda, quarta e sexta saindo do Bom Fim às 07h45. Curto ouvir indie rock no caminho e conversar sobre tecnologia!",
  campuses: ["campus_vale", "campus_centro"],
  avg_rating: 4.9,
  rating_count: 27,
  is_driver: true,
  car_model: "Volkswagen Nivus Highline",
  car_plate: "BRA2E19",
  car_color: "Cinza Moonstone",
  is_verified: true,
  profile_complete: true,
};

export const MOCK_PASSENGER_USER: UserPrivate = {
  id: 9002,
  name: "Marina Costa Silveira",
  email: "marina.silveira@ufrgs.br",
  course: "Arquitetura e Urbanismo",
  gender: "female",
  phone: "(51) 99123-4567",
  photo_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
  social_link: "@marina.arq",
  bio: "Estudante do 6º semestre de Arquitetura. Sempre pontual no ponto de encontro! Costumo pegar carona entre a Cidade Baixa e o Campus Centro/Vale.",
  campuses: ["campus_centro", "campus_vale"],
  avg_rating: 4.8,
  rating_count: 14,
  is_driver: false,
  car_model: null,
  car_plate: null,
  car_color: null,
  is_verified: true,
  profile_complete: true,
};

export const MOCK_INCOMPLETE_USER: UserPrivate = {
  id: 9003,
  name: "Lucas Ferreira Martins",
  email: "lucas.martins@ece.ufrgs.br",
  course: null,
  gender: null,
  phone: null,
  photo_url: null,
  social_link: null,
  bio: null,
  campuses: [],
  avg_rating: 5.0,
  rating_count: 0,
  is_driver: false,
  car_model: null,
  car_plate: null,
  car_color: null,
  is_verified: true,
  profile_complete: false,
};

export const MOCK_FEMALE_DRIVER_PUBLIC: UserPublic = {
  id: 9004,
  name: "Beatriz Almeida",
  course: "Engenharia Química",
  photo_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80",
  social_link: "@bia.engquimica",
  bio: "Saio do Moinhos de Vento rumo ao Campus do Vale pelas manhãs. Carona tranquila e ar-condicionado sempre ligado!",
  campuses: ["campus_vale", "campus_saude"],
  avg_rating: 5.0,
  rating_count: 41,
  is_driver: true,
  car_model: "Hyundai HB20 Platinum",
  car_color: "Branco",
};

// ─── Mock Route Geometry (Campus Centro -> Av. Ipiranga -> Campus do Vale) ──

export const MOCK_ROUTE_GEOJSON: GeoJSON.LineString = {
  type: "LineString",
  coordinates: [
    [-51.2177, -30.0349], // Campus Centro
    [-51.2089, -30.0395], // Campus Saúde
    [-51.1935, -30.0462], // Av. Ipiranga / Silva Só
    [-51.1789, -30.0538], // ESEFID / Jardim Botânico
    [-51.1582, -30.0589], // Av. Ipiranga / PUC
    [-51.1378, -30.0664], // Campus Agronomia
    [-51.1201, -30.0734], // Campus do Vale
  ],
};

// ─── Mock Rides (Different Visual States for RideCard Showcase) ──────────────

const tomorrowMorning = new Date(Date.now() + 18 * 3600 * 1000).toISOString();
const tomorrowAfternoon = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

export const MOCK_RIDE_STANDARD: RideDetail = {
  id: 501,
  driver: MOCK_DRIVER_USER,
  origin_label: "Campus Centro UFRGS (Farroupilha)",
  destination_label: "Campus do Vale UFRGS (Prédio 43412 - INF)",
  campus_point: "campus_vale",
  origin_lat: -30.0349,
  origin_lng: -51.2177,
  destination_lat: -30.0734,
  destination_lng: -51.1201,
  departure_at: tomorrowMorning,
  delay_tolerance_minutes: 10,
  total_seats: 3,
  available_seats: 2,
  women_only: false,
  status: "active",
  route_distance_meters: 11800,
  route_duration_seconds: 1380,
  route_geojson: MOCK_ROUTE_GEOJSON,
  detour_meters: 420,
  detour_seconds: 95,
};

export const MOCK_RIDE_WOMEN_ONLY: RidePublic = {
  id: 502,
  driver: MOCK_FEMALE_DRIVER_PUBLIC,
  origin_label: "Parcão (Moinhos de Vento)",
  destination_label: "Campus do Vale UFRGS",
  campus_point: "campus_vale",
  origin_lat: -30.0277,
  origin_lng: -51.2016,
  destination_lat: -30.0734,
  destination_lng: -51.1201,
  departure_at: tomorrowAfternoon,
  delay_tolerance_minutes: 5,
  total_seats: 3,
  available_seats: 1,
  women_only: true,
  status: "active",
  route_distance_meters: 12400,
  route_duration_seconds: 1500,
  route_geojson: MOCK_ROUTE_GEOJSON,
  detour_meters: 1850,
  detour_seconds: 340,
};

export const MOCK_RIDE_FULL: RidePublic = {
  ...MOCK_RIDE_STANDARD,
  id: 503,
  available_seats: 0,
  status: "full",
  detour_meters: 610,
  detour_seconds: 120,
};

// ─── Mock Match Requests for Driver's RideRequestsModal ──────────────────────

export const MOCK_DRIVER_REQUESTS: MatchForDriver[] = [
  {
    id: 7001,
    ride_id: 501,
    status: "pending",
    passenger: MOCK_PASSENGER_USER,
    pickup_region: "Cidade Baixa / Redenção (Raio aprox. 600m)",
    detour_meters: 420,
    detour_seconds: 95,
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 7002,
    ride_id: 501,
    status: "accepted",
    passenger: {
      id: 9005,
      name: "Gabriel Souza",
      course: "Engenharia de Computação",
      photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
      social_link: "@gabrielsouza.ecp",
      bio: "Moro perto do Hospital de Clínicas, sempre pronto 5 min antes!",
      campuses: ["campus_saude", "campus_vale"],
      avg_rating: 4.95,
      rating_count: 19,
      is_driver: false,
    },
    pickup_region: "Santa Cecília / HCPA",
    detour_meters: 290,
    detour_seconds: 60,
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
];

export const MOCK_CONFIRMED_DETAILS: Record<number, MatchConfirmed> = {
  7001: {
    id: 7001,
    ride_id: 501,
    status: "accepted",
    detour_meters: 420,
    detour_seconds: 95,
    pickup_label: "Av. Osvaldo Aranha, 1020 (Em frente ao Instituto de Educação)",
    dropoff_label: "Campus do Vale UFRGS",
    pickup_region: "Cidade Baixa / Redenção",
    pickup_lat: -30.0365,
    pickup_lng: -51.2135,
    passenger_phone: "(51) 99123-4567",
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    responded_at: new Date().toISOString(),
  },
  7002: {
    id: 7002,
    ride_id: 501,
    status: "accepted",
    detour_meters: 290,
    detour_seconds: 60,
    pickup_label: "Rua Ramiro Barcelos, 2350 (Portaria Principal HCPA - Campus Saúde)",
    dropoff_label: "Campus do Vale UFRGS",
    pickup_region: "Santa Cecília / HCPA",
    pickup_lat: -30.0395,
    pickup_lng: -51.2089,
    passenger_phone: "(51) 99654-3210",
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    responded_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
};
