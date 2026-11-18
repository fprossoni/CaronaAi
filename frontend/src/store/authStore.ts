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
  blockedByUser: Record<number, number[]>;
  setTokens: (access: string, refresh: string, user?: UserPrivate) => void;
  setUser: (user: UserPrivate) => void;
  fetchUser: () => Promise<UserPrivate | null>;
  logout: () => void;
  isUserBlocked: (targetUserId: number) => boolean;
  setUserBlocked: (targetUserId: number, blocked: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: !!localStorage.getItem("access_token"),
      blockedByUser: {},

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

      isUserBlocked: (targetUserId: number): boolean => {
        const currentUserId = get().user?.id;
        if (!currentUserId) return false;
        return (get().blockedByUser[currentUserId] ?? []).includes(targetUserId);
      },

      setUserBlocked: (targetUserId: number, blocked: boolean) => {
        const currentUserId = get().user?.id;
        if (!currentUserId) return;
        set((state) => {
          const currentList = state.blockedByUser[currentUserId] ?? [];
          const nextList = blocked
            ? Array.from(new Set([...currentList, targetUserId]))
            : currentList.filter((id) => id !== targetUserId);
          return {
            blockedByUser: {
              ...state.blockedByUser,
              [currentUserId]: nextList,
            },
          };
        });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        blockedByUser: state.blockedByUser,
      }),
    }
  )
);
