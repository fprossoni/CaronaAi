import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserPrivate } from "@/types/user";
import { usersApi } from "@/api/auth";

// Clean up simulated credentials left by a previous run on this origin.
if (localStorage.getItem("access_token") === "dev_mock_token") {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("auth-storage");
}

let sessionVersion = 0;

interface AuthState {
  user: UserPrivate | null;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string, user?: UserPrivate) => void;
  setUser: (user: UserPrivate) => void;
  fetchUser: () => Promise<UserPrivate | null>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: !!localStorage.getItem("access_token"),

      setTokens: (access, refresh, user) => {
        sessionVersion++;
        localStorage.setItem("access_token", access);
        localStorage.setItem("refresh_token", refresh);
        set({ user: user ?? null, isAuthenticated: true });
      },

      setUser: (user) => set({ user }),

      fetchUser: async (): Promise<UserPrivate | null> => {
        const version = sessionVersion;
        try {
          const { data } = await usersApi.getMe();
          if (version !== sessionVersion) return get().user;
          set({ user: data, isAuthenticated: true });
          return data;
        } catch {
          if (version !== sessionVersion) return get().user;
          set({ user: null, isAuthenticated: false });
          return null;
        }
      },

      logout: () => {
        sessionVersion++;
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
