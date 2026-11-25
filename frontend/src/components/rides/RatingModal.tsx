/**
 * RatingModal Component
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
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
  1: "1 · Ruim",
  2: "2 · Abaixo do esperado",
  3: "3 · Regular",
  4: "4 · Boa viagem",
  5: "5 · Excelente",
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
    setLoading(true);
    try {
      await ratingsApi.create({
        match_id: matchId,
        rated_user_id: ratedUser.id,
        stars,
        comment: comment.trim() || undefined,
      });
      toast.success("Avaliação enviada");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error("Erro ao avaliar", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-1000 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[10px] p-5 sm:p-6 border border-border-strong bg-surface shadow-lg animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-text">Avaliar viagem</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
            aria-label="Fechar"
          >
            <XIcon size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-surface-2">
            <Avatar name={ratedUser.name} photoUrl={ratedUser.photo_url} size="md" />
            <div className="min-w-0">
              <p className="font-bold text-sm text-text truncate">
                {ratedUser.name ?? "Estudante UFRGS"}
              </p>
              <p className="text-xs text-text-muted truncate">
                {ratedUser.role === "driver" ? "Motorista" : "Passageiro"}
                {ratedUser.course ? ` · ${ratedUser.course}` : ""}
              </p>
            </div>
          </div>

          <div className="text-center py-2">
            <div className="flex items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onMouseEnter={() => setHoverStars(value)}
                  onMouseLeave={() => setHoverStars(null)}
                  onClick={() => setStars(value)}
                  className="p-1.5 rounded-md transition-transform hover:scale-110 focus:outline-none"
                  aria-label={`${value} estrelas`}
                >
                  <StarIcon
                    size={30}
                    filled={value <= activeStars}
                    className={
                      value <= activeStars ? "text-primary" : "text-border-strong"
                    }
                  />
                </button>
              ))}
            </div>
            <p className="font-mono text-xs font-semibold mt-2 text-accent-text">
              {STAR_LABELS[activeStars]}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-text-muted">
              Comentário (opcional)
            </label>
            <textarea
              rows={3}
              maxLength={250}
              placeholder="Pontualidade, trajeto..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-3 rounded-md text-sm border border-border bg-surface-2 text-text placeholder:text-text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={loading}>
              Enviar
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
