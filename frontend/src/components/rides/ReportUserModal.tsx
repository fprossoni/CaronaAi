import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usersApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { AlertTriangleIcon, XIcon } from "@/components/ui/Icons";

interface ReportUserModalProps {
  targetUser: {
    id: number;
    name: string | null;
  };
  rideId: number;
  onClose: () => void;
}

const REPORT_REASONS = [
  "Atraso excessivo ou não comparecimento",
  "Comportamento inadequado",
  "Direção imprudente",
  "Veículo diferente do informado",
  "Cobrança fora do combinado",
  "Outro motivo de segurança",
];

export const ReportUserModal: React.FC<ReportUserModalProps> = ({
  targetUser,
  rideId,
  onClose,
}) => {
  const toast = useToastStore();
  const setUserBlocked = useAuthStore((state) => state.setUserBlocked);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const detailsId = useId();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersApi.reportUser(targetUser.id, {
        reason,
        details: details.trim() || null,
        ride_id: rideId,
        block: alsoBlock,
      });
      if (alsoBlock) {
        setUserBlocked(targetUser.id, true);
      }

      onClose();
    } catch (err: unknown) {
      toast.error("Erro ao enviar relato", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-[10px] border border-border-strong bg-surface text-text shadow-lg backdrop:bg-black/75"
    >
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="shrink-0 p-2 rounded-md border border-danger/30 bg-danger/10 text-danger">
              <AlertTriangleIcon size={18} />
            </div>
            <div className="min-w-0 wrap-anywhere">
              <h3 id={titleId} className="font-display text-base font-bold">
                Reportar ocorrência
              </h3>
              <p className="font-mono text-[11px] text-text-muted">
                {targetUser.name ?? "Participante"} · #{rideId}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar denúncia"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
          >
            <XIcon size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-text-muted">
              Motivo
            </label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((item) => (
                <label
                  key={item}
                  className={`flex items-start gap-2.5 p-2.5 rounded-md border text-xs text-text cursor-pointer transition-colors ${
                    reason === item
                      ? "border-danger bg-danger/10"
                      : "border-border bg-surface-2 hover:border-border-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    checked={reason === item}
                    onChange={() => setReason(item)}
                    className="mt-0.5 shrink-0 accent-danger"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor={detailsId}
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-text-muted"
            >
              Detalhes (opcional)
            </label>
            <textarea
              id={detailsId}
              rows={3}
              maxLength={400}
              placeholder="Descreva o ocorrido..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full p-3 rounded-md text-sm border border-border bg-surface-2 text-text placeholder:text-text-muted outline-none focus:border-danger focus:ring-1 focus:ring-danger/30 resize-none"
            />
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-md border border-border bg-surface-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={alsoBlock}
              onChange={(e) => setAlsoBlock(e.target.checked)}
              className="mt-0.5 shrink-0 accent-danger"
            />
            <span className="min-w-0 wrap-anywhere">
              Bloquear <strong className="text-text">{targetUser.name ?? "este usuário"}</strong>
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" size="sm" loading={loading}>
              Enviar denúncia
            </Button>
          </div>
        </form>
      </div>
    </dialog>,
    document.body
  );
};
