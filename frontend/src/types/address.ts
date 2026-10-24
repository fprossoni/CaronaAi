export interface AddressBase {
  label: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood?: string | null;
  postal_code: string;
  city: string;
  state: string;
  country: string;
}

export interface AddressCreate extends AddressBase {}

export interface AddressPublic extends AddressBase {
  id: number;
  user_id: number;
  lat: number;
  lng: number;
  created_at: string;
  full_address?: string | null;
}

export interface CepLookupResponse {
  postal_code: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
}

export interface GeocodeRequest {
  street: string;
  number: string;
  postal_code?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface GeocodeResponse {
  lat: number;
  lng: number;
  neighborhood?: string | null;
  display_name: string;
}
