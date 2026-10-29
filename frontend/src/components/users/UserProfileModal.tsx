/**
 * UserProfileModal Component
 *
 * Displays a LinkedIn + Instagram + BlaBlaCar inspired social profile card
 * for any user in the platform (drivers or passengers).
 * Supports viewing academic course, UFRGS verification badge, bio, frequented campuses,
 * social media handle, vehicle details, and blocking/unblocking the user.
 */

import React, { useEffect, useState } from "react";
import type { UserPublic } from "@/types/user";
import { usersApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { buildSocialUrl, getCampusInfo } from "@/lib/formatters";
import { getErrorMessage } from "@/lib/errors";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  BanIcon,
  CarIcon,
  GraduationCapIcon,
  InstagramIcon,
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
  const { user: currentUser } = useAuthStore();
  const toast = useToastStore();
  const [profile, setProfile] = useState<UserPublic>(initialUser);
  const [blocking, setBlocking] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const isSelf = currentUser?.id === profile.id;

  useEffect(() => {
    if (initialUser.id >= 9000 || localStorage.getItem("access_token") === "dev_mock_token") {
      return;
    }
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
        description:
          "Vocês não verão mais as caronas ou solicitações um do outro nas buscas do Carona Aí.",
        confirmLabel: "Bloquear usuário",
        variant: "danger",
      });
      if (!ok) return;
    }

    if (profile.id >= 9000 || localStorage.getItem("access_token") === "dev_mock_token") {
      setIsBlocked((prev) => !prev);
      if (isBlocked) {
        toast.info("Usuário desbloqueado.");
      } else {
        toast.success(
          "Usuário bloqueado",
          "As caronas deste perfil não aparecerão mais para você."
        );
      }
      onBlockedChange?.();
      return;
    }

    setBlocking(true);
    try {
      if (isBlocked) {
        await usersApi.unblockUser(profile.id);
        setIsBlocked(false);
        toast.info("Usuário desbloqueado.");
      } else {
        await usersApi.blockUser(profile.id);
        setIsBlocked(true);
        toast.success(
          "Usuário bloqueado",
          "As caronas deste perfil não aparecerão mais para você."
        );
      }
      onBlockedChange?.();
    } catch (err: unknown) {
      toast.error("Não foi possível concluir a ação", getErrorMessage(err));
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden border shadow-2xl animate-slide-up"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* LinkedIn-style Cover Banner */}
        <div
          className="h-28 relative"
          style={{ background: "var(--gradient-cover)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
            aria-label="Fechar perfil"
          >
            <XIcon size={16} />
          </button>

          <div className="absolute bottom-3 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md text-emerald-300 text-[11px] font-semibold border border-emerald-400/30">
            <ShieldCheckIcon size={13} />
            <span>Membro Verificado UFRGS</span>
          </div>
        </div>

        {/* Profile Header & Avatar */}
        <div className="px-6 pb-6">
          <div className="-mt-12 mb-3 flex items-end justify-between">
            <Avatar
              name={profile.name}
              photoUrl={profile.photo_url}
              size="xl"
              ring
            />

            <div
              className="flex items-center gap-3 px-3.5 py-2 rounded-2xl border"
              style={{
                backgroundColor: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="text-center">
                <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                  <StarIcon size={15} filled />
                  <span>{profile.avg_rating.toFixed(1)}</span>
                </div>
                <span className="text-[10px] block" style={{ color: "var(--color-text-muted)" }}>
                  Nota média
                </span>
              </div>
              <div className="w-px h-6" style={{ backgroundColor: "var(--color-border)" }} />
              <div className="text-center">
                <span className="font-bold text-sm block" style={{ color: "var(--color-text)" }}>
                  {profile.rating_count}
                </span>
                <span className="text-[10px] block" style={{ color: "var(--color-text-muted)" }}>
                  Avaliações
                </span>
              </div>
            </div>
          </div>

          {/* Name & Academic Course */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
                {profile.name ?? "Estudante UFRGS"}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  profile.is_driver
                    ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                    : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                {profile.is_driver ? "Motorista & Passageiro" : "Passageiro"}
              </span>
            </div>

            <p
              className="text-sm mt-1 flex items-center gap-1.5 font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <GraduationCapIcon size={16} className="text-indigo-400 shrink-0" />
              <span>{profile.course ?? "Curso não informado"}</span>
            </p>
          </div>

          {/* Bio Section */}
          {profile.bio ? (
            <div
              className="mt-4 p-3.5 rounded-2xl text-sm leading-relaxed border"
              style={{
                backgroundColor: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-secondary)",
              }}
            >
              “{profile.bio}”
            </div>
          ) : (
            <p className="mt-3 text-xs italic" style={{ color: "var(--color-text-muted)" }}>
              Este estudante ainda não adicionou uma bio.
            </p>
          )}

          {/* Campuses & Social Handle */}
          <div className="mt-4 space-y-3">
            {profile.campuses && profile.campuses.length > 0 && (
              <div>
                <span
                  className="text-[11px] font-bold uppercase tracking-wider block mb-1.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Campi que frequenta
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {profile.campuses.map((cId) => {
                    const c = getCampusInfo(cId);
                    return (
                      <span
                        key={cId}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
                        style={{
                          backgroundColor: "var(--color-surface-2)",
                          borderColor: "var(--color-border)",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        <MapPinIcon size={12} className="text-indigo-400" />
                        {c.shortName}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {profile.is_driver && (profile.car_model || profile.car_color) && (
              <div
                className="flex items-center gap-3 p-3 rounded-2xl border"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                }}
              >
                <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
                  <CarIcon size={18} />
                </div>
                <div className="text-xs">
                  <span className="block font-semibold" style={{ color: "var(--color-text)" }}>
                    {profile.car_model ?? "Veículo cadastrado"}
                  </span>
                  {profile.car_color && (
                    <span style={{ color: "var(--color-text-muted)" }}>
                      Cor: {profile.car_color}
                    </span>
                  )}
                </div>
              </div>
            )}

            {profile.social_link && (
              <a
                href={buildSocialUrl(profile.social_link)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all hover:scale-[1.01]"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  borderColor: "var(--color-border-strong)",
                  color: "var(--color-primary-light)",
                }}
              >
                <InstagramIcon size={15} className="text-pink-400" />
                <span>Rede social: {profile.social_link}</span>
              </a>
            )}
          </div>

          {/* Actions Footer */}
          <div className="mt-6 pt-4 border-t flex items-center justify-between gap-3" style={{ borderColor: "var(--color-border)" }}>
            {!isSelf ? (
              <button
                type="button"
                disabled={blocking}
                onClick={handleToggleBlock}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
              >
                <BanIcon size={14} />
                <span>
                  {blocking
                    ? "Processando..."
                    : isBlocked
                    ? "Desbloquear usuário"
                    : "Bloquear usuário"}
                </span>
              </button>
            ) : (
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Visualização pública do seu perfil
              </span>
            )}

            <Button variant="secondary" size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
