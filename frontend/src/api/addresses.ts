import { apiClient } from "./client";
import type {
  AddressCreate,
  AddressPublic,
  CepLookupResponse,
  GeocodeRequest,
  GeocodeResponse,
} from "@/types/address";

export const addressesApi = {
  list: () => apiClient.get<AddressPublic[]>("/addresses/"),

  create: (data: AddressCreate) => apiClient.post<AddressPublic>("/addresses/", data),

  delete: (id: number) => apiClient.delete(`/addresses/${id}`),

  lookupCep: (cep: string) => apiClient.get<CepLookupResponse>(`/addresses/cep/${cep}`),

  geocode: (data: GeocodeRequest) => apiClient.post<GeocodeResponse>("/addresses/geocode", data),
};
