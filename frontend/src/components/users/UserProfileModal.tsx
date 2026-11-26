import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { UserPublic } from "@/types/user";
import { usersApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { getCampusInfo } from "@/lib/formatters";
import { getErrorMessage } from "@/lib/errors";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  BanIcon,
  CarIcon,
  GraduationCapIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StarIcon,
  XIcon,
} from "@/components/ui/Icons";

interface UserProfileModalProps {
  user: UserPublic;
  onClose: () => void;
  onBlockedChange?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user: initialUser,
  onClose,
  onBlockedChange,
}) => {
  const { user: currentUser, blockedByUser, setUserBlocked } = useAuthStore();
  const toast = useToastStore();
  const [profile, setProfile] = useState<UserPublic>(initialUser);
  const [blocking, setBlocking] = useState(false);

  const isSelf = currentUser?.id === profile.id;
  const isBlocked = Boolean(
    currentUser?.id && (blockedByUser[currentUser.id] ?? []).includes(profile.id)
  );

  useEffect(() => {
    let active = true;
    usersApi
      .getUser(initialUser.id)
      .then(({ data }) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        // Keep initialUser fallback
      });
    return () => {
      active = false;
    };
  }, [initialUser.id]);

  const handleToggleBlock = async () => {
    if (isSelf) return;

    if (!isBlocked) {
      const ok = await toast.confirm({
        title: `Bloquear ${profile.name ?? "este usuário"}?`,
        description: "Caronas e solicitações deste perfil não aparecerão mais para você.",
        confirmLabel: "Bloquear",
        variant: "danger",
      });
      if (!ok) return;
    }

    setBlocking(true);
    try {
      if (isBlocked) {
        await usersApi.unblockUser(profile.id);
        setUserBlocked(profile.id, false);
        toast.info("Usuário desbloqueado.");
      } else {
        await usersApi.blockUser(profile.id);
        setUserBlocked(profile.id, true);
        toast.success("Usuário bloqueado");
      }
      onBlockedChange?.();
    } catch (err: unknown) {
      toast.error("Erro ao atualizar bloqueio", getErrorMessage(err));
    } finally {
      setBlocking(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-1000 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[10px] overflow-hidden border border-border-strong bg-surface shadow-lg animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-24 relative z-0 bg-bg-elevated bg-topo-pattern border-b border-border">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-md border border-border bg-surface/90 text-text flex items-center justify-center hover:border-border-strong transition-colors"
            aria-label="Fechar perfil"
          >
            <XIcon size={15} />
          </button>

          <div className="absolute bottom-2.5 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-surface/90 backdrop-blur-md text-secondary font-mono text-[10px] font-semibold border border-border-strong">
            <ShieldCheckIcon size={12} />
            <span>UFRGS</span>
          </div>
        </div>
        <div className="px-5 pb-5 relative z-10">
          <div className="-mt-10 mb-3 flex items-end justify-between gap-3">
            <Avatar name={profile.name} photoUrl={profile.photo_url} size="xl" ring />

            <div className="flex items-center gap-3 px-3 py-1.5 rounded-md border border-border bg-surface-2">
              <div className="text-center">
                <div className="flex items-center gap-1 text-accent-text font-mono font-bold text-sm">
                  <StarIcon size={13} filled />
                  <span>{profile.avg_rating.toFixed(1)}</span>
                </div>
                <span className="font-mono text-[9px] uppercase block text-text-muted">Nota</span>
              </div>
              <div className="w-px h-5 bg-border" />
              <div className="text-center">
                <span className="font-mono font-bold text-sm block text-text">
                  {profile.rating_count}
                </span>
                <span className="font-mono text-[9px] uppercase block text-text-muted">
                  Aval.
                </span>
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-lg font-bold text-text">
                {profile.name ?? "Estudante UFRGS"}
              </h3>
              {profile.age != null && (
                <span className="font-mono text-xs text-text-muted">· {profile.age} anos</span>
              )}
              <span
                className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold uppercase ${
                  profile.is_driver
                    ? "bg-primary/15 text-accent-text border border-primary/35"
                    : "bg-secondary/15 text-secondary border border-secondary/35"
                }`}
              >
                {profile.is_driver ? "Motorista" : "Passageiro"}
              </span>
            </div>

            <p className="text-xs mt-1 flex items-center gap-1.5 font-medium text-text-secondary">
              <GraduationCapIcon size={14} className="text-accent-text shrink-0" />
              <span>{profile.course ?? "Curso não informado"}</span>
            </p>
          </div>

          {profile.bio && (
            <div className="mt-3.5 p-3 rounded-md text-xs leading-relaxed border border-border bg-surface-2 text-text-secondary">
              “{profile.bio}”
            </div>
          )}
          <div className="mt-3.5 space-y-2.5">
            {profile.campuses && profile.campuses.length > 0 && (
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-text-muted">
                  Campi
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {profile.campuses.map((cId) => {
                    const c = getCampusInfo(cId);
                    return (
                      <span
                        key={cId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] font-mono text-[11px] font-medium border border-border bg-surface-2 text-text-secondary"
                      >
                        <MapPinIcon size={11} className="text-accent-text" />
                        {c.shortName}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {profile.is_driver && (profile.car_brand || profile.car_model) && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-md border border-border bg-surface-2">
                <div className="p-1.5 rounded-md bg-surface text-accent-text border border-border">
                  <CarIcon size={15} />
                </div>
                <div className="text-xs">
                  <span className="block font-semibold text-text">
                    {[profile.car_brand, profile.car_model].filter(Boolean).join(" ") || "Veículo"}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between gap-3">
            {!isSelf ? (
              <button
                type="button"
                disabled={blocking}
                onClick={handleToggleBlock}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger hover:underline"
              >
                <BanIcon size={13} />
                <span>
                  {blocking ? "Processando…" : isBlocked ? "Desbloquear" : "Bloquear"}
                </span>
              </button>
            ) : (
              <span className="font-mono text-[11px] text-text-muted">Seu perfil</span>
            )}

            <Button variant="secondary" size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
