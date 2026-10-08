// TypeScript types mirroring backend Pydantic schemas

export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

export interface UserPublic {
  id: number;
  name: string | null;
  course: string | null;
  photo_url: string | null;
  social_link: string | null;
  bio: string | null;
  campuses: string[] | null;
  avg_rating: number;
  rating_count: number;
  is_driver: boolean;
}

export interface UserPrivate extends UserPublic {
  email: string;
  gender: Gender | null;
  phone: string | null;
  car_model: string | null;
  car_plate: string | null;
  car_color: string | null;
  is_verified: boolean;
  profile_complete: boolean;
}

export interface ProfileUpdate {
  course?: string;
  gender?: Gender;
  phone?: string;
  photo_url?: string;
  social_link?: string;
  bio?: string;
  campuses?: string[];
  is_driver?: boolean;
  car_model?: string;
  car_plate?: string;
  car_color?: string;
}
