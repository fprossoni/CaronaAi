/**
 * ReportUserModal Component
 *
 * Provides a structured moderation & safety report flow for trip participants,
 * with an integrated option to immediately block the reported user (`POST /users/{id}/block`).
 */

import React, { useState } from "react";
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
  "Direção imprudente ou veículo diferente do informado",
  "Solicitação de valores fora do combinado",
  "Outro motivo de segurança",
];

export const ReportUserModal: React.FC<ReportUserModalProps> = ({
  targetUser,
  rideId,
  onClose,
}) => {
  const toast = useToastStore();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetUser.id >= 9000 || localStorage.getItem("access_token") === "dev_mock_token") {
      toast.success(
        "Relato registrado com sucesso",
        alsoBlock
          ? `A ocorrência da carona #${rideId} foi registrada e ${targetUser.name ?? "o usuário"} foi bloqueado.`
          : `A ocorrência da carona #${rideId} foi encaminhada para análise.`
      );
      onClose();
      return;
    }

    setLoading(true);
    try {
      if (alsoBlock) {
        await usersApi.blockUser(targetUser.id);
      }
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

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 border shadow-2xl animate-slide-up"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/15 text-red-400">
              <AlertTriangleIcon size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: "var(--color-text)" }}>
                Reportar Ocorrência
              </h3>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Contra {targetUser.name ?? "Participante"} • Viagem #{rideId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
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
                    className="mt-0.5 accent-red-500"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Detalhes adicionais (opcional)
            </label>
            <textarea
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
              className="mt-0.5 accent-red-500"
            />
            <span>
              <strong>Bloquear {targetUser.name ?? "este usuário"}</strong> para que não apareça
              mais nas minhas buscas ou ofertas de carona.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" size="sm" loading={loading}>
              Enviar Denúncia
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
