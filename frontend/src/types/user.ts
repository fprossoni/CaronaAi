// TypeScript types mirroring backend Pydantic schemas

export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

export interface UserPublic {
  id: number;
  name: string | null;
  course: string | null;
  gender: Gender | null;
  photo_url: string | null;
  age: number | null; // derived from birth_date — the date itself is private
  bio: string | null;
  campuses: string[] | null;
  avg_rating: number;
  rating_count: number;
  is_driver: boolean;
  car_model?: string | null;
  car_brand?: string | null;
}

export interface UserConfirmed extends UserPublic {
  phone: string | null;
  social_link: string | null;
  instagram: string | null;
  car_color: string | null;
  car_plate: string | null;
}

export interface UserPrivate extends UserConfirmed {
  email: string;
  birth_date: string | null; // YYYY-MM-DD
  car_model: string | null;
  car_plate: string | null;
  car_color: string | null;
  is_verified: boolean;
  profile_complete: boolean;
}

export interface ProfileUpdate {
  name?: string;
  car_brand?: string;
  course?: string;
  gender?: Gender;
  phone?: string;
  photo_url?: string;
  social_link?: string;
  instagram?: string;
  bio?: string;
  campuses?: string[];
  birth_date?: string;
  is_driver?: boolean;
  car_model?: string;
  car_plate?: string;
  car_color?: string;
}
