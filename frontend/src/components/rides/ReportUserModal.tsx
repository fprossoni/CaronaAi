/**
 * ReportUserModal Component
 *
 * Provides a structured moderation & safety report flow for trip participants,
 * persisting the report (`POST /users/{id}/report`) with an integrated option
 * to immediately block the reported user in the same request.
 */

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usersApi } from "@/api/auth";
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
  "Atraso excessivo ou não comparecimento no ponto combinado",
  "Comportamento desrespeitoso ou inadequado",
  "Direção imprudente",
  "Veículo diferente do informado",
  "Solicitação de valores fora do combinado",
  "Outro motivo de segurança",
];

export const ReportUserModal: React.FC<ReportUserModalProps> = ({
  targetUser,
  rideId,
  onClose,
}) => {
  const toast = useToastStore();
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
      toast.success(
        "Relato registrado com sucesso",
        alsoBlock
          ? `A ocorrência da carona #${rideId} foi registrada e ${targetUser.name ?? "o usuário"} foi bloqueado.`
          : `A ocorrência da carona #${rideId} foi encaminhada para análise.`
      );
      onClose();
    } catch (err: unknown) {
      toast.error("Erro ao processar relato", getErrorMessage(err));
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
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-xl backdrop:bg-black/70"
    >
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="shrink-0 p-2 rounded-xl bg-red-500/15 text-red-400">
              <AlertTriangleIcon size={20} />
            </div>
            <div className="min-w-0 wrap-anywhere">
              <h3 id={titleId} className="text-base font-bold">
                Reportar Ocorrência
              </h3>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Contra {targetUser.name ?? "Participante"} • Viagem #{rideId}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar denúncia"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-full hover:bg-white/10 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <XIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-xs font-semibold mb-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Motivo principal
            </label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((item) => (
                <label
                  key={item}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors"
                  style={{
                    backgroundColor:
                      reason === item ? "rgba(239, 68, 68, 0.1)" : "var(--color-surface-2)",
                    borderColor:
                      reason === item ? "var(--color-danger)" : "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    checked={reason === item}
                    onChange={() => setReason(item)}
                    className="mt-0.5 shrink-0 accent-red-500"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor={detailsId}
              className="block text-xs font-semibold mb-1.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Detalhes adicionais (opcional)
            </label>
            <textarea
              id={detailsId}
              rows={3}
              maxLength={400}
              placeholder="Descreva brevemente o que aconteceu..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full p-3 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
              style={{
                backgroundColor: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <label
            className="flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            <input
              type="checkbox"
              checked={alsoBlock}
              onChange={(e) => setAlsoBlock(e.target.checked)}
              className="mt-0.5 shrink-0 accent-red-500"
            />
            <span className="min-w-0 wrap-anywhere">
              <strong>Bloquear {targetUser.name ?? "este usuário"}</strong> para que não apareça
              mais nas minhas buscas ou ofertas de carona.
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" size="sm" loading={loading}>
              Enviar Denúncia
            </Button>
          </div>
        </form>
      </div>
    </dialog>,
    document.body,
  );
};
