/**
 * Global Toast & Confirmation Dialog Store
 *
 * Replaces blocking browser `alert()` and `window.confirm()` calls with
 * accessible, non-blocking UI notifications and confirmation modals.
 */

import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
}

interface ConfirmDialogState extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

interface ToastState {
  toasts: ToastItem[];
  confirmDialog: ConfirmDialogState | null;
  addToast: (toast: Omit<ToastItem, "id">, durationMs?: number) => void;
  removeToast: (id: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  closeConfirm: (result: boolean) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  confirmDialog: null,

  addToast: (toast, durationMs = 4200) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    setTimeout(() => {
      get().removeToast(id);
    }, durationMs);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  success: (title, description) => {
    get().addToast({ title, description, variant: "success" });
  },

  error: (title, description) => {
    get().addToast({ title, description, variant: "error" }, 5200);
  },

  info: (title, description) => {
    get().addToast({ title, description, variant: "info" });
  },

  confirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        confirmDialog: {
          ...options,
          resolve,
        },
      });
    });
  },

  closeConfirm: (result) => {
    const current = get().confirmDialog;
    if (current) {
      current.resolve(result);
    }
    set({ confirmDialog: null });
  },
}));
