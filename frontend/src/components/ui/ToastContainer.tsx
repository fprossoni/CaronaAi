/**
 * Global Toast & Confirmation Dialog Container
 *
 * Renders active toast notifications in the top-right/bottom-center viewport
 * and displays the promise-based confirmation modal when triggered via `useToastStore`.
 */

import React from "react";
import { useToastStore } from "@/store/toastStore";
import { AlertTriangleIcon, CheckCircleIcon, XIcon } from "./Icons";
import { Button } from "./Button";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast, confirmDialog, closeConfirm } = useToastStore();

  return (
    <>
      {/* Floating Toasts */}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const borderColors = {
            success: "border-emerald-500/50 bg-emerald-500/10",
            error: "border-red-500/50 bg-red-500/10",
            warning: "border-amber-500/50 bg-amber-500/10",
            info: "border-indigo-500/50 bg-indigo-500/10",
          }[toast.variant];

          const iconColors = {
            success: "text-emerald-400",
            error: "text-red-400",
            warning: "text-amber-400",
            info: "text-indigo-400",
          }[toast.variant];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border backdrop-blur-xl shadow-xl animate-slide-up ${borderColors}`}
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border-strong)",
              }}
            >
              <span className={`mt-0.5 shrink-0 ${iconColors}`}>
                {toast.variant === "success" ? (
                  <CheckCircleIcon size={19} />
                ) : (
                  <AlertTriangleIcon size={19} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                style={{ color: "var(--color-text-muted)" }}
                aria-label="Fechar notificação"
              >
                <XIcon size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in"
          onClick={() => closeConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 border shadow-2xl animate-slide-up"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  confirmDialog.variant === "danger"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-indigo-500/15 text-indigo-400"
                }`}
              >
                <AlertTriangleIcon size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold" style={{ color: "var(--color-text)" }}>
                  {confirmDialog.title}
                </h3>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                  {confirmDialog.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <Button variant="ghost" size="sm" onClick={() => closeConfirm(false)}>
                {confirmDialog.cancelLabel ?? "Voltar"}
              </Button>
              <Button
                variant={confirmDialog.variant ?? "primary"}
                size="sm"
                onClick={() => closeConfirm(true)}
              >
                {confirmDialog.confirmLabel ?? "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
