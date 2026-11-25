import { apiClient } from "./client";
import type { ReportCreate, ReportPublic } from "@/types/report";
import type { UserPublic, UserPrivate, ProfileUpdate } from "@/types/user";

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    apiClient.post<{ message: string; dev_token?: string }>("/auth/register", data),

  verifyEmail: (data: { email: string; token: string }) =>
    apiClient.post<{ access_token: string; refresh_token: string; token_type: string }>("/auth/verify-email", data),

  login: (data: { email: string; password: string }) =>
    apiClient.post<{ access_token: string; refresh_token: string; token_type: string }>("/auth/login", data),

  resendVerification: (email: string) =>
    apiClient.post<{ message: string; dev_token?: string }>("/auth/resend-verification", { email }),

  forgotPassword: (email: string) =>
    apiClient.post<{ message: string; dev_token?: string }>("/auth/forgot-password", { email }),

  resetPassword: (data: { email: string; token: string; password: string }) =>
    apiClient.post<{ message: string }>("/auth/reset-password", data),
};

export const usersApi = {
  getMe: () => apiClient.get<UserPrivate>("/users/me"),

  updateMe: (data: ProfileUpdate) => apiClient.patch<UserPrivate>("/users/me", data),

  getUser: (id: number) => apiClient.get<UserPublic>("/users/" + id),

  blockUser: (id: number) => apiClient.post(`/users/${id}/block`),

  unblockUser: (id: number) => apiClient.delete(`/users/${id}/block`),

  reportUser: (id: number, data: ReportCreate) =>
    apiClient.post<{ message: string; report_id: number }>(`/users/${id}/report`, data),

  getMyReports: () => apiClient.get<ReportPublic[]>("/users/me/reports"),
};
