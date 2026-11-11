import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserPrivate } from "@/types/user";
import { usersApi } from "@/api/auth";
import { DEV_MOCK_TOKEN, isDevSession } from "@/lib/devSession";

// Clean up simulated credentials left by a previous run on this origin.
if (!import.meta.env.DEV && localStorage.getItem("access_token") === DEV_MOCK_TOKEN) {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("auth-storage");
}

interface AuthState {
  user: UserPrivate | null;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: UserPrivate) => void;
  /** Injects a simulated user session for the `/dev` playground without requiring backend auth */
  setDevSession: (mockUser: UserPrivate) => void;
  fetchUser: () => Promise<UserPrivate | null>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: !!localStorage.getItem("access_token"),

      setTokens: (access, refresh) => {
        localStorage.setItem("access_token", access);
        localStorage.setItem("refresh_token", refresh);
        set({ isAuthenticated: true });
      },

      setUser: (user) => set({ user }),

      setDevSession: (mockUser) => {
        if (!import.meta.env.DEV) return;
        localStorage.setItem("access_token", DEV_MOCK_TOKEN);
        localStorage.removeItem("refresh_token");
        set({ user: mockUser, isAuthenticated: true });
      },

      fetchUser: async (): Promise<UserPrivate | null> => {
        // Preserve mock user when testing in the /dev playground
        if (isDevSession()) {
          return get().user;
        }
        try {
          const { data } = await usersApi.getMe();
          if (isDevSession()) return get().user;
          set({ user: data, isAuthenticated: true });
          return data;
        } catch {
          if (isDevSession()) return get().user;
          set({ user: null, isAuthenticated: false });
          return null;
        }
      },

      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }),
    }
  )
);
