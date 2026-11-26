import React from "react";
import { useToastStore } from "@/store/toastStore";

import { Button } from "./Button";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast, confirmDialog, closeConfirm } = useToastStore();

  return (
    <>
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const borderColors = {
            success: "border-secondary/50",
            error: "border-danger/50",
            warning: "border-warning/60",
            info: "border-primary/50",
          }[toast.variant];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-[10px] border bg-surface/95 backdrop-blur-md shadow-lg animate-slide-up ${borderColors}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text">
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="text-xs mt-0.5 leading-relaxed text-text-muted">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-md text-text-muted opacity-70 hover:opacity-100 hover:bg-surface-2 transition-colors"
                aria-label="Fechar notificação"
              >
                Fechar
              </button>
            </div>
          );
        })}
      </div>
      {confirmDialog && (
        <div
          className="fixed inset-0 z-9998 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
          onClick={() => closeConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-[10px] p-5 sm:p-6 border border-border-strong bg-surface shadow-lg animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="text-base font-bold text-text">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs mt-1.5 leading-relaxed text-text-muted">
                  {confirmDialog.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
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
