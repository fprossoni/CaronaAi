/**
 * RatingModal Component
 *
 * Allows a passenger or driver to rate a trip participant (1 to 5 stars + optional comment)
 * via `POST /ratings/`.
 */

import React, { useState } from "react";
import { ratingsApi } from "@/api/ratings";
import { useToastStore } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errors";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StarIcon, XIcon } from "@/components/ui/Icons";

interface RatingModalProps {
  matchId: number;
  ratedUser: {
    id: number;
    name: string | null;
    course?: string | null;
    photo_url?: string | null;
    role: "driver" | "passenger";
  };
  onClose: () => void;
  onSuccess: () => void;
}

const STAR_LABELS: Record<number, string> = {
  1: "1 estrela — Experiência ruim",
  2: "2 estrelas — Abaixo do esperado",
  3: "3 estrelas — Regular",
  4: "4 estrelas — Muito boa viagem!",
  5: "5 estrelas — Excelente companhia e pontualidade!",
};

export const RatingModal: React.FC<RatingModalProps> = ({
  matchId,
  ratedUser,
  onClose,
  onSuccess,
}) => {
  const toast = useToastStore();
  const [stars, setStars] = useState<number>(5);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const activeStars = hoverStars ?? stars;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ratedUser.id >= 9000 || localStorage.getItem("access_token") === "dev_mock_token") {
      toast.success(
        "Avaliação enviada!",
        `Sua nota de ${stars} estrelas para ${ratedUser.name ?? "o participante"} foi registrada.`
      );
      onSuccess();
      onClose();
      return;
    }

    setLoading(true);
    try {
      await ratingsApi.create({
        match_id: matchId,
        rated_user_id: ratedUser.id,
        stars,
        comment: comment.trim() || undefined,
      });
      toast.success(
        "Avaliação enviada!",
        `Sua nota de ${stars} estrelas para ${ratedUser.name ?? "o participante"} foi registrada.`
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error("Erro ao enviar avaliação", getErrorMessage(err));
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
          <h3 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
            Avaliar Carona
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <XIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Participant Info */}
          <div
            className="flex items-center gap-3.5 p-3.5 rounded-2xl border"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <Avatar name={ratedUser.name} photoUrl={ratedUser.photo_url} size="md" ring />
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--color-text)" }}>
                {ratedUser.name ?? "Estudante UFRGS"}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {ratedUser.role === "driver" ? "Motorista da viagem" : "Passageiro(a) da viagem"}
                {ratedUser.course ? ` • ${ratedUser.course}` : ""}
              </p>
            </div>
          </div>

          {/* Interactive 1–5 Star Selector */}
          <div className="text-center py-2">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>
              Como foi viajar com {ratedUser.name?.split(" ")[0] ?? "este colega"}?
            </p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onMouseEnter={() => setHoverStars(value)}
                  onMouseLeave={() => setHoverStars(null)}
                  onClick={() => setStars(value)}
                  className="p-2 rounded-xl transition-transform hover:scale-110 focus:outline-none"
                  aria-label={`${value} estrelas`}
                >
                  <StarIcon
                    size={34}
                    filled={value <= activeStars}
                    className={
                      value <= activeStars
                        ? "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]"
                        : "text-slate-600"
                    }
                  />
                </button>
              ))}
            </div>
            <p className="text-xs font-medium mt-2 text-amber-400">
              {STAR_LABELS[activeStars]}
            </p>
          </div>

          {/* Optional Comment */}
          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Comentário ou elogio (opcional)
            </label>
            <textarea
              rows={3}
              maxLength={250}
              placeholder="Ex.: Muito pontual, direção super tranquila, ótimo papo até o Campus do Vale!"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-3 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
              style={{
                backgroundColor: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={loading}>
              Enviar Avaliação
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
