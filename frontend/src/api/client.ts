import axios, { type AxiosInstance } from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
type RefreshedTokens = { access_token: string; refresh_token: string };
const refreshRequests = new Map<string, Promise<RefreshedTokens>>();

function refreshSession(refreshToken: string) {
  const pending = refreshRequests.get(refreshToken);
  if (pending) return pending;

  const request = axios.post<RefreshedTokens>(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
    .then(({ data }) => data)
    .finally(() => refreshRequests.delete(refreshToken));
  refreshRequests.set(refreshToken, request);
  return request;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ─── Request interceptor — attach JWT ────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — handle 401 ───────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const accessToken = localStorage.getItem("access_token");
      if (!accessToken || originalRequest.headers.Authorization !== `Bearer ${accessToken}`) {
        return Promise.reject(error);
      }
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");

      if (refreshToken) {
        try {
          const data = await refreshSession(refreshToken);
          const currentRefreshToken = localStorage.getItem("refresh_token");
          if (currentRefreshToken !== refreshToken && currentRefreshToken !== data.refresh_token) {
            return Promise.reject(error);
          }
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return apiClient(originalRequest);
        } catch {
          if (localStorage.getItem("refresh_token") !== refreshToken) return Promise.reject(error);
          // Refresh failed — clear tokens and redirect to login
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      } else {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);
