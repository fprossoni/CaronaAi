import { apiClient } from "./client";
import type { UserPrivate, ProfileUpdate } from "@/types/user";

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    apiClient.post<{ message: string; dev_token?: string }>("/auth/register", data),

  verifyEmail: (data: { email: string; token: string }) =>
    apiClient.post<{ access_token: string; refresh_token: string; token_type: string }>("/auth/verify-email", data),

  login: (data: { email: string; password: string }) =>
    apiClient.post<{ access_token: string; refresh_token: string; token_type: string }>("/auth/login", data),

  resendVerification: () =>
    apiClient.post<{ message: string }>("/auth/resend-verification"),
};

export const usersApi = {
  getMe: () => apiClient.get<UserPrivate>("/users/me"),

  updateMe: (data: ProfileUpdate) => apiClient.patch<UserPrivate>("/users/me", data),

  getUser: (id: number) => apiClient.get<UserPrivate>("/users/" + id),

  blockUser: (id: number) => apiClient.post(`/users/${id}/block`),

  unblockUser: (id: number) => apiClient.delete(`/users/${id}/block`),
};
