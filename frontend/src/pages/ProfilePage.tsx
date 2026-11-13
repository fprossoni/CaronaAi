/**
 * ProfilePage ("Meu Perfil")
 *
 * LinkedIn + Instagram + BlaBlaCar inspired personal profile & settings page:
 * - View Mode: Cover banner, institutional UFRGS unit badge (including `@*.ufrgs.br` subdomains),
 *   Avatar with gradient ring, academic course, bio, frequented campuses, social handle,
 *   reputation stats, and Mercosul vehicle card.
 * - Edit Mode: Full profile editing integrated with `PATCH /users/me`, including course
 *   autocomplete, driver/passenger preference switcher, and vehicle validation.
 */

import React, { useState } from "react";
import { usersApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { UFRGS_CAMPUS } from "@/types/ride";
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

  // Edit form state initialized from current user
  const [course, setCourse] = useState(user?.course ?? "");
  const [birthDate, setBirthDate] = useState(user?.birth_date ?? "");
  const [gender, setGender] = useState<Gender>(user?.gender ?? "prefer_not_to_say");
  const [isDriver, setIsDriver] = useState<boolean>(user?.is_driver ?? false);
  const [photoUrl, setPhotoUrl] = useState(user?.photo_url ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [instagram, setInstagram] = useState(user?.instagram ?? user?.social_link ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [campuses, setCampuses] = useState<string[]>(user?.campuses ?? []);
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
      toast.error("Curso obrigatório", "Informe seu curso de graduação ou pós-graduação na UFRGS.");
      return;
    }
    if (birthDate.trim()) {
      const birthDateErr = validateBirthDate(birthDate);
      if (birthDateErr) {
        toast.error("Data de nascimento inválida", birthDateErr);
        return;
      }
    }
    if (isDriver && carPlate.trim() && !isValidCarPlate(carPlate)) {
      toast.error(
        "Placa inválida",
        "Utilize o padrão ABC1234 ou Mercosul ABC1C34."
      );
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
        car_model: isDriver ? carModel.trim() || undefined : undefined,
        car_color: isDriver ? carColor.trim() || undefined : undefined,
        car_plate:
          isDriver && carPlate.trim() ? formatCarPlate(carPlate) : undefined,
      };

      const { data } = await usersApi.updateMe(payload);
      setUser(data);
      setIsEditing(false);
      toast.success("Perfil atualizado!", "Suas informações foram salvas com sucesso.");
    } catch (err: unknown) {
      toast.error("Erro ao atualizar perfil", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const ok = await toast.confirm({
      title: "Sair da sua conta?",
      description: "Você precisará fazer login novamente para acessar suas caronas.",
      confirmLabel: "Sair",
      variant: "danger",
    });
    if (ok) logout();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Main Social Header Card (LinkedIn / Instagram Inspired) */}
      <div
        className="rounded-3xl overflow-hidden border shadow-xl"
        style={{
          background: "var(--gradient-card)",
          borderColor: "var(--color-border)",
        }}
      >
        {/* Cover Banner */}
        <div
          className="h-32 md:h-36 relative"
          style={{ background: "var(--gradient-cover)" }}
        >
          <div className="absolute bottom-3 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/45 backdrop-blur-md text-emerald-300 text-xs font-semibold border border-emerald-400/30">
            <ShieldCheckIcon size={14} />
            <span>{affiliation.fullBadge}</span>
          </div>
        </div>

        {/* Avatar + Identity Bar */}
        <div className="px-6 pb-6">
          <div className="-mt-12 mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar
                name={user.name}
                photoUrl={isEditing ? photoUrl || null : user.photo_url}
                size="xl"
                ring
              />
              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-extrabold" style={{ color: "var(--color-text)" }}>
                    {user.name}
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      user.is_driver
                        ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {user.is_driver ? "Motorista & Passageiro" : "Passageiro"}
                  </span>
                </div>
                <p
                  className="text-sm font-medium flex items-center gap-1.5 mt-0.5"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <GraduationCapIcon size={16} className="text-indigo-400 shrink-0" />
                  <span>{user.course ?? "Curso não informado"}</span>
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <Button variant="secondary" size="sm" onClick={startEditing}>
                  <EditIcon size={15} />
                  <span>Editar Perfil</span>
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  Cancelar Edição
                </Button>
              )}

              <Button variant="danger" size="sm" onClick={handleLogout}>
                <LogOutIcon size={15} />
                <span>Sair</span>
              </Button>
            </div>
          </div>

          {/* Stats Strip */}
          <div
            className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl border text-center"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <div>
              <div className="flex items-center justify-center gap-1 text-amber-400 font-extrabold text-lg">
                <StarIcon size={18} filled />
                <span>{user.avg_rating.toFixed(1)}</span>
              </div>
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                Avaliação Média
              </span>
            </div>

            <div className="border-x" style={{ borderColor: "var(--color-border)" }}>
              <span className="font-extrabold text-lg block" style={{ color: "var(--color-text)" }}>
                {user.rating_count}
              </span>
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                Avaliações Recebidas
              </span>
            </div>

            <div>
              <span className="font-extrabold text-sm md:text-base block text-indigo-400 truncate px-1">
                {affiliation.shortBadge}
              </span>
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                Vínculo Institucional
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode vs Edit Mode */}
      {!isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Bio, Contact & Campuses */}
          <div
            className="md:col-span-7 rounded-3xl p-6 border space-y-5 shadow-md"
            style={{
              background: "var(--gradient-card)",
              borderColor: "var(--color-border)",
            }}
          >
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                Sobre mim / Bio
              </h2>
              {user.bio ? (
                <p
                  className="text-sm leading-relaxed p-3.5 rounded-2xl border"
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  “{user.bio}”
                </p>
              ) : (
                <p className="text-xs italic" style={{ color: "var(--color-text-muted)" }}>
                  Nenhuma apresentação cadastrada. Clique em "Editar Perfil" para contar um pouco
                  sobre seus horários e estilo de viagem.
                </p>
              )}
            </div>

            {/* Campi Frequentados */}
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                Campi da UFRGS que frequenta
              </h2>
              {user.campuses && user.campuses.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.campuses.map((cId) => {
                    const c = getCampusInfo(cId);
                    return (
                      <span
                        key={cId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
                        style={{
                          backgroundColor: "var(--color-surface-2)",
                          borderColor: "var(--color-border)",
                          color: "var(--color-text)",
                        }}
                      >
                        <MapPinIcon size={13} className="text-indigo-400" />
                        {c.name}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs italic" style={{ color: "var(--color-text-muted)" }}>
                  Nenhum campus selecionado ainda.
                </p>
              )}
            </div>

            {/* Contact & Personal Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
              <div
                className="p-3 rounded-2xl border"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                }}
              >
                <span className="text-[11px] block" style={{ color: "var(--color-text-muted)" }}>
                  E-mail Institucional
                </span>
                <span className="text-xs font-bold truncate block mt-0.5" style={{ color: "var(--color-text)" }}>
                  {user.email}
                </span>
              </div>

              <div
                className="p-3 rounded-2xl border"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                }}
              >
                <span className="text-[11px] block" style={{ color: "var(--color-text-muted)" }}>
                  Telefone / WhatsApp
                </span>
                <span className="text-xs font-bold block mt-0.5" style={{ color: "var(--color-text)" }}>
                  {user.phone || "Não informado"}
                </span>
              </div>

              <div
                className="p-3 rounded-2xl border"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                }}
              >
                <span className="text-[11px] block" style={{ color: "var(--color-text-muted)" }}>
                  Gênero & Idade
                </span>
                <span className="text-xs font-bold block mt-0.5" style={{ color: "var(--color-text)" }}>
                  {getGenderLabel(user.gender)}
                  {user.age != null ? ` • ${user.age} anos` : ""}
                </span>
              </div>

              <div
                className="p-3 rounded-2xl border"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                }}
              >
                <span className="text-[11px] block" style={{ color: "var(--color-text-muted)" }}>
                  Instagram / Rede Social
                </span>
                {displaySocial ? (
                  <a
                    href={buildSocialUrl(displaySocial)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-indigo-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    <InstagramIcon size={13} className="text-pink-400" />
                    <span>{displaySocial}</span>
                  </a>
                ) : (
                  <span className="text-xs font-bold block mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    Não informada
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Vehicle & Driver Card */}
          <div
            className="md:col-span-5 rounded-3xl p-6 border flex flex-col justify-between space-y-5 shadow-md"
            style={{
              background: "var(--gradient-card)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--color-text-muted)" }}>
                  <CarIcon size={15} className="text-indigo-400" />
                  Meu Veículo
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    user.is_driver
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-slate-500/20 text-slate-400"
                  }`}
                >
                  {user.is_driver ? "Motorista Ativo" : "Apenas Passageiro"}
                </span>
              </div>

              {user.is_driver ? (
                <div className="space-y-4">
                  {/* Brazilian Mercosul Plate Visual */}
                  <div className="rounded-2xl overflow-hidden border-2 border-slate-700 bg-white text-slate-900 shadow-md max-w-[230px] mx-auto">
                    <div className="bg-blue-700 text-white text-[10px] font-extrabold px-3 py-1 flex items-center justify-between tracking-widest">
                      <span>MERCOSUL</span>
                      <span>BRASIL 🇧🇷</span>
                    </div>
                    <div className="py-2.5 text-center font-mono text-2xl font-black tracking-[0.22em]">
                      {user.car_plate || "SEM-PLACA"}
                    </div>
                  </div>

                  <div
                    className="p-3.5 rounded-2xl border space-y-1.5 text-xs"
                    style={{
                      backgroundColor: "var(--color-surface-2)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <div className="flex justify-between">
                      <span style={{ color: "var(--color-text-muted)" }}>Modelo:</span>
                      <strong style={{ color: "var(--color-text)" }}>
                        {user.car_model || "Não informado"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--color-text-muted)" }}>Cor:</span>
                      <strong style={{ color: "var(--color-text)" }}>
                        {user.car_color || "Não informada"}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="p-4 rounded-2xl border text-xs leading-relaxed"
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Você está cadastrado apenas como passageiro. Caso queira oferecer caronas no
                  futuro, clique em <strong>Editar Perfil</strong> e habilite a opção de motorista.
                </div>
              )}
            </div>

            <Button variant="secondary" fullWidth size="sm" onClick={startEditing}>
              <EditIcon size={14} />
              <span>Atualizar Dados ou Veículo</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Full Edit Mode Form */
        <form
          onSubmit={handleSaveProfile}
          className="rounded-3xl p-6 md:p-8 border space-y-6 shadow-xl animate-fade-in"
          style={{
            background: "var(--gradient-card)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--color-border)" }}>
            <div>
              <h2 className="text-lg font-extrabold" style={{ color: "var(--color-text)" }}>
                Editar Meu Perfil
              </h2>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Mantenha seus dados atualizados para facilitar o match com outros estudantes.
              </p>
            </div>
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
              label="Data de Nascimento"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Telefone / WhatsApp"
              placeholder="(51) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
            />

            <Input
              label="Instagram"
              placeholder="@seu_usuario"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />

            <Input
              label="URL da Foto de Perfil (opcional)"
              placeholder="https://exemplo.com/sua-foto.jpg"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
              Bio / Apresentação curta ({bio.length}/250)
            </label>
            <textarea
              rows={3}
              maxLength={250}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Conte seus horários habituais, estilo musical no carro, etc."
              className="w-full p-3 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
              style={{
                backgroundColor: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          {/* Gender & Role Preference */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
                Gênero
              </label>
              <div className="grid grid-cols-2 gap-2">
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(opt.value)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-all"
                    style={{
                      backgroundColor:
                        gender === opt.value
                          ? "rgba(99, 102, 241, 0.16)"
                          : "var(--color-surface-2)",
                      borderColor:
                        gender === opt.value ? "var(--color-primary)" : "var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
                Modo de Uso na Plataforma
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsDriver(false)}
                  className="p-2.5 rounded-xl text-xs font-semibold border text-left transition-all"
                  style={{
                    backgroundColor: !isDriver
                      ? "rgba(16, 185, 129, 0.16)"
                      : "var(--color-surface-2)",
                    borderColor: !isDriver ? "var(--color-secondary)" : "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <span className="block font-bold">Só Passageiro</span>
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    Apenas pedir caronas
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDriver(true)}
                  className="p-2.5 rounded-xl text-xs font-semibold border text-left transition-all"
                  style={{
                    backgroundColor: isDriver
                      ? "rgba(99, 102, 241, 0.16)"
                      : "var(--color-surface-2)",
                    borderColor: isDriver ? "var(--color-primary)" : "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <span className="block font-bold">Motorista & Passageiro</span>
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    Oferecer e pedir
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Campuses */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
              Campi da UFRGS que você frequenta
            </label>
            <div className="flex flex-wrap gap-2">
              {UFRGS_CAMPUS.map((c) => {
                const selected = campuses.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleToggleCampus(c.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={{
                      backgroundColor: selected ? "var(--color-primary)" : "var(--color-surface-2)",
                      borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
                      color: selected ? "#ffffff" : "var(--color-text-secondary)",
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vehicle Details (when Driver mode is enabled) */}
          {isDriver && (
            <div
              className="p-4 rounded-2xl border space-y-3"
              style={{
                backgroundColor: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
              }}
            >
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <CarIcon size={15} /> Dados do Veículo
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Modelo"
                  placeholder="Ex.: VW Gol 2022"
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                />
                <Input
                  label="Cor"
                  placeholder="Ex.: Prata"
                  value={carColor}
                  onChange={(e) => setCarColor(e.target.value)}
                />
                <Input
                  label="Placa (Mercosul / Antiga)"
                  placeholder="ABC1C34"
                  maxLength={7}
                  value={carPlate}
                  onChange={(e) => setCarPlate(formatCarPlate(e.target.value))}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Salvar Alterações
            </Button>
          </div>
        </form>
      )}

      {/* Personal Saved Addresses Manager (CEP / ViaCEP + Nominatim) */}
      <SavedAddressesManager />
    </div>
  );
};
