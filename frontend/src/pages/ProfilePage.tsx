/**
 * ProfilePage ("Meu Perfil")
 *
 * Technical academic profile with topographic banner, Mercosul plate card,
 * saved addresses, and moderation reports.
 */

import React, { useState } from "react";
import { usersApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { CAMPUS_LIST } from "@/types/ride";
import type { Gender, ProfileUpdate } from "@/types/user";
import {
  buildSocialUrl,
  formatCarPlate,
  formatPhone,
  formatSocialHandle,
  getCampusInfo,
  getGenderLabel,
  isValidCarPlate,
} from "@/lib/formatters";
import { extractUfrgsAffiliation, validateBirthDate } from "@/lib/validators";
import { getErrorMessage } from "@/lib/errors";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CourseAutocomplete } from "@/components/ui/CourseAutocomplete";
import { Input } from "@/components/ui/Input";
import { SavedAddressesManager } from "@/components/profile/SavedAddressesManager";
import { ReportsManager } from "@/components/profile/ReportsManager";
import {
  CarIcon,
  EditIcon,
  GraduationCapIcon,
  InstagramIcon,
  LogOutIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StarIcon,
} from "@/components/ui/Icons";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Masculino" },
  { value: "female", label: "Feminino" },
  { value: "other", label: "Outro" },
  { value: "prefer_not_to_say", label: "Prefiro não informar" },
];

export const ProfilePage: React.FC = () => {
  const { user, setUser, logout } = useAuthStore();
  const toast = useToastStore();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [course, setCourse] = useState(user?.course ?? "");
  const [birthDate, setBirthDate] = useState(user?.birth_date ?? "");
  const [gender, setGender] = useState<Gender>(user?.gender ?? "prefer_not_to_say");
  const [isDriver, setIsDriver] = useState<boolean>(user?.is_driver ?? false);
  const [photoUrl, setPhotoUrl] = useState(user?.photo_url ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [instagram, setInstagram] = useState(user?.instagram ?? user?.social_link ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [campuses, setCampuses] = useState<string[]>(user?.campuses ?? []);
  const [carBrand, setCarBrand] = useState(user?.car_brand ?? "");
  const [carModel, setCarModel] = useState(user?.car_model ?? "");
  const [carColor, setCarColor] = useState(user?.car_color ?? "");
  const [carPlate, setCarPlate] = useState(user?.car_plate ?? "");

  if (!user) return null;

  const affiliation = extractUfrgsAffiliation(user.email);
  const displaySocial = user.instagram || user.social_link;

  const startEditing = () => {
    setCourse(user.course ?? "");
    setBirthDate(user.birth_date ?? "");
    setGender(user.gender ?? "prefer_not_to_say");
    setIsDriver(user.is_driver);
    setPhotoUrl(user.photo_url ?? "");
    setBio(user.bio ?? "");
    setInstagram(user.instagram ?? user.social_link ?? "");
    setPhone(user.phone ?? "");
    setCampuses(user.campuses ?? []);
    setCarBrand(user.car_brand ?? "");
    setCarModel(user.car_model ?? "");
    setCarColor(user.car_color ?? "");
    setCarPlate(user.car_plate ?? "");
    setIsEditing(true);
  };

  const handleToggleCampus = (id: string) => {
    setCampuses((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course.trim()) {
      toast.error("Curso obrigatório", "Informe seu curso na UFRGS.");
      return;
    }
    if (!phone.trim() || !birthDate.trim() || (isDriver && (!carBrand.trim() || !carModel.trim() || !carColor.trim() || !carPlate.trim()))) {
      toast.error("Dados obrigatórios", "Preencha telefone, nascimento e todos os dados do veículo para motoristas.");
      return;
    }
    if (birthDate.trim()) {
      const birthDateErr = validateBirthDate(birthDate);
      if (birthDateErr) {
        toast.error("Data inválida", birthDateErr);
        return;
      }
    }
    if (isDriver && carPlate.trim() && !isValidCarPlate(carPlate)) {
      toast.error("Placa inválida", "Use ABC1234 ou ABC1C34.");
      return;
    }

    setSaving(true);
    try {
      const formattedInsta = instagram.trim() ? formatSocialHandle(instagram) : undefined;
      const payload: ProfileUpdate = {
        course: course.trim(),
        birth_date: birthDate.trim() || undefined,
        gender,
        is_driver: isDriver,
        photo_url: photoUrl.trim() || undefined,
        bio: bio.trim() || undefined,
        instagram: formattedInsta,
        social_link: formattedInsta,
        phone: phone.trim() ? formatPhone(phone) : undefined,
        campuses,
        car_brand: isDriver ? carBrand.trim() || undefined : undefined,
        car_model: isDriver ? carModel.trim() || undefined : undefined,
        car_color: isDriver ? carColor.trim() || undefined : undefined,
        car_plate: isDriver && carPlate.trim() ? formatCarPlate(carPlate) : undefined,
      };

      const { data } = await usersApi.updateMe(payload);
      setUser(data);
      setIsEditing(false);
      toast.success("Perfil atualizado");
    } catch (err: unknown) {
      toast.error("Erro ao atualizar", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const ok = await toast.confirm({
      title: "Sair da conta?",
      description: "Você precisará entrar novamente para acessar suas caronas.",
      confirmLabel: "Sair",
      variant: "danger",
    });
    if (ok) logout();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Main Profile Header Card */}
      <div className="rounded-[10px] overflow-hidden border border-border-strong bg-surface shadow-md">
        {/* Topographic Cover Banner */}
        <div className="h-28 md:h-32 relative z-0 bg-bg-elevated bg-topo-pattern border-b border-border">
          <div className="absolute top-3 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-surface/90 backdrop-blur-md text-secondary font-mono text-[11px] font-semibold border border-border-strong">
            <ShieldCheckIcon size={13} />
            <span>{affiliation.fullBadge}</span>
          </div>
        </div>

        {/* Avatar + Identity Bar */}
        <div className="px-5 sm:px-6 pb-6 relative z-10">
          <div className="-mt-10 mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar
                name={user.name}
                photoUrl={isEditing ? photoUrl || null : user.photo_url}
                size="xl"
                ring
              />
              <div className="pb-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-xl md:text-2xl font-bold text-text">
                    {user.name}
                  </h1>
                  <span
                    className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold uppercase ${
                      user.is_driver
                        ? "bg-primary/15 text-accent-text border border-primary/35"
                        : "bg-secondary/15 text-secondary border border-secondary/35"
                    }`}
                  >
                    {user.is_driver ? "Motorista" : "Passageiro"}
                  </span>
                </div>
                <p className="text-sm font-medium flex items-center gap-1.5 mt-0.5 text-text-secondary">
                  <GraduationCapIcon size={15} className="text-accent-text shrink-0" />
                  <span>{user.course ?? "Curso não informado"}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isEditing ? (
                <Button variant="secondary" size="sm" onClick={startEditing}>
                  <EditIcon size={14} />
                  <span>Editar</span>
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
              )}

              <Button variant="danger" size="sm" onClick={handleLogout}>
                <LogOutIcon size={14} />
                <span>Sair</span>
              </Button>
            </div>
          </div>

          {/* Stats Strip */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-md border border-border bg-surface-2 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-accent-text font-mono font-bold text-lg">
                <StarIcon size={15} filled />
                <span>{user.avg_rating.toFixed(1)}</span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                Nota
              </span>
            </div>

            <div className="border-x border-border">
              <span className="font-mono font-bold text-lg block text-text">
                {user.rating_count}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                Avaliações
              </span>
            </div>

            <div>
              <span className="font-mono font-bold text-sm md:text-base block text-text truncate px-1 leading-7">
                {affiliation.shortBadge}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                Vínculo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode vs Edit Mode */}
      {!isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left Column */}
          <div className="md:col-span-7 rounded-[10px] p-5 border border-border bg-surface space-y-5">
            <div>
              <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider mb-2 text-text-muted">
                Bio
              </h2>
              {user.bio ? (
                <p className="text-sm leading-relaxed p-3 rounded-md border border-border bg-surface-2 text-text-secondary">
                  “{user.bio}”
                </p>
              ) : (
                <p className="text-xs text-text-muted">Sem bio cadastrada.</p>
              )}
            </div>

            <div>
              <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider mb-2 text-text-muted">
                Campi
              </h2>
              {user.campuses && user.campuses.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {user.campuses.map((cId) => {
                    const c = getCampusInfo(cId);
                    return (
                      <span
                        key={cId}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] font-mono text-xs font-medium border border-border bg-surface-2 text-text"
                      >
                        <MapPinIcon size={12} className="text-accent-text" />
                        {c.name}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-text-muted">Nenhum campus selecionado.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-border">
              <div className="p-3 rounded-md border border-border bg-surface-2">
                <span className="font-mono text-[10px] uppercase tracking-wider block text-text-muted">
                  E-mail
                </span>
                <span className="text-xs font-semibold truncate block mt-0.5 text-text">
                  {user.email}
                </span>
              </div>

              <div className="p-3 rounded-md border border-border bg-surface-2">
                <span className="font-mono text-[10px] uppercase tracking-wider block text-text-muted">
                  WhatsApp
                </span>
                <span className="font-mono text-xs font-semibold block mt-0.5 text-text">
                  {user.phone || "—"}
                </span>
              </div>

              <div className="p-3 rounded-md border border-border bg-surface-2">
                <span className="font-mono text-[10px] uppercase tracking-wider block text-text-muted">
                  Gênero · Idade
                </span>
                <span className="text-xs font-semibold block mt-0.5 text-text">
                  {getGenderLabel(user.gender)}
                  {user.age != null ? ` · ${user.age} anos` : ""}
                </span>
              </div>

              <div className="p-3 rounded-md border border-border bg-surface-2">
                <span className="font-mono text-[10px] uppercase tracking-wider block text-text-muted">
                  Instagram
                </span>
                {displaySocial ? (
                  <a
                    href={buildSocialUrl(displaySocial)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-accent-text hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    <InstagramIcon size={12} />
                    <span>{displaySocial}</span>
                  </a>
                ) : (
                  <span className="text-xs font-semibold block mt-0.5 text-text-muted">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Vehicle */}
          <div className="md:col-span-5 rounded-[10px] p-5 border border-border bg-surface flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-text-muted">
                  <CarIcon size={14} className="text-accent-text" />
                  Veículo
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold uppercase ${
                    user.is_driver
                      ? "bg-secondary/15 text-secondary"
                      : "bg-surface-2 text-text-muted"
                  }`}
                >
                  {user.is_driver ? "Ativo" : "Inativo"}
                </span>
              </div>

              {user.is_driver ? (
                <div className="space-y-3.5">
                  {/* Minimalist Technical Plate */}
                  <div className="rounded-[4px] overflow-hidden border border-border-strong bg-white text-[#0b0c0d] shadow-sm max-w-56 mx-auto">
                    <div className="bg-[#0b0c0d] text-[#f4f5f2] font-mono text-[9px] font-bold px-2.5 py-1 flex items-center justify-between tracking-widest border-b border-border-strong">
                      <span>BRASIL</span>
                      <span className="text-[#fa952d]">MERCOSUL</span>
                    </div>
                    <div className="py-2 text-center font-mono text-2xl font-bold tracking-[0.22em]">
                      {user.car_plate || "SEM PLACA"}
                    </div>
                  </div>

                  <div className="p-3 rounded-md border border-border bg-surface-2 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Modelo</span>
                      <strong className="text-text">{[user.car_brand, user.car_model].filter(Boolean).join(" ") || "—"}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Cor</span>
                      <strong className="text-text">{user.car_color || "—"}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-md border border-border bg-surface-2 text-xs text-text-muted">
                  Modo passageiro ativo.
                </div>
              )}
            </div>

            <Button variant="secondary" fullWidth size="sm" onClick={startEditing}>
              <EditIcon size={14} />
              <span>Editar dados</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Full Edit Mode Form */
        <form
          onSubmit={handleSaveProfile}
          className="rounded-[10px] p-5 sm:p-7 border border-border-strong bg-surface space-y-5 shadow-md animate-fade-in"
        >
          <div className="border-b border-border pb-3">
            <h2 className="font-display text-lg font-bold text-text">Editar perfil</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <CourseAutocomplete
                value={course}
                onChange={setCourse}
                required
                label="Curso na UFRGS"
              />
            </div>

            <Input
              label="Nascimento"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              required
              label="WhatsApp"
              placeholder="(51) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
            />

            <Input
              label="Instagram"
              placeholder="@usuario"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />

            <Input
              label="URL da foto (opcional)"
              placeholder="https://..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Bio
              </label>
              <span className="font-mono text-[11px] text-text-muted">{bio.length}/250</span>
            </div>
            <textarea
              rows={3}
              maxLength={250}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Horários, campus, preferências..."
              className="w-full p-3 rounded-md text-sm border border-border bg-surface-2 text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-text-muted">
                Gênero
              </label>
              <div className="grid grid-cols-2 gap-2">
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(opt.value)}
                    className={`px-3 py-2 rounded-md text-xs font-semibold border text-text text-left transition-colors ${
                      gender === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface-2 hover:border-border-strong"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-text-muted">
                Modalidade
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsDriver(false)}
                  className={`p-2.5 rounded-md text-xs font-semibold border text-text text-left transition-colors ${
                    !isDriver
                      ? "border-secondary bg-secondary/10"
                      : "border-border bg-surface-2 hover:border-border-strong"
                  }`}
                >
                  <span className="block font-bold">Passageiro</span>
                  <span className="text-[11px] text-text-muted">Pedir caronas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDriver(true)}
                  className={`p-2.5 rounded-md text-xs font-semibold border text-text text-left transition-colors ${
                    isDriver
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface-2 hover:border-border-strong"
                  }`}
                >
                  <span className="block font-bold">Motorista</span>
                  <span className="text-[11px] text-text-muted">Oferecer e pedir</span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-text-muted">
              Campi
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CAMPUS_LIST.map((c) => {
                const selected = campuses.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleToggleCampus(c.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                      selected
                        ? "bg-primary border-primary text-on-primary"
                        : "bg-surface-2 border-border text-text-secondary hover:border-border-strong"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {isDriver && (
            <div className="p-4 rounded-md border border-border bg-surface-2 space-y-3">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-accent-text flex items-center gap-1.5">
                <CarIcon size={14} /> Veículo
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Marca" value={carBrand} onChange={(e) => setCarBrand(e.target.value)} required />
                <Input
                  required
                  label="Modelo"
                  placeholder="VW Gol 2022"
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                />
                <Input
                  required
                  label="Cor"
                  placeholder="Prata"
                  value={carColor}
                  onChange={(e) => setCarColor(e.target.value)}
                />
                <Input
                  required
                  label="Placa"
                  placeholder="ABC1C34"
                  maxLength={7}
                  value={carPlate}
                  onChange={(e) => setCarPlate(formatCarPlate(e.target.value))}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Salvar
            </Button>
          </div>
        </form>
      )}

      <SavedAddressesManager />
      <ReportsManager />
    </div>
  );
};
