import { apiClient } from "./client";
import type { Gender, UserPrivate } from "@/types/user";

type DevAccount = Pick<UserPrivate, "id" | "is_driver" | "gender"> & { name: string };

export interface DevSession {
  user: UserPrivate;
  access_token: string;
  refresh_token: string;
}

function workspaceConfig() {
  const storageKey = "carona-dev-workspace";
  let workspace = localStorage.getItem(storageKey);
  if (!workspace) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    workspace = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(storageKey, workspace);
  }
  return { headers: { "X-Dev-Workspace": workspace } };
}

export const devAccountsApi = {
  list: (signal: AbortSignal) => apiClient.get<DevAccount[]>("/dev/accounts", { ...workspaceConfig(), signal }),
  create: (name: string, gender: Gender) =>
    apiClient.post<DevSession>("/dev/accounts", { name, gender }, workspaceConfig()),
  signIn: (id: number) =>
    apiClient.post<DevSession>(`/dev/accounts/${id}/session`, null, workspaceConfig()),
};
