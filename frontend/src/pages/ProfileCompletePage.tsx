import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usersApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CourseAutocomplete } from "@/components/ui/CourseAutocomplete";
import { Input } from "@/components/ui/Input";
import { getErrorMessage } from "@/lib/errors";
import {
  formatCarPlate,
  formatPhone,
  formatSocialHandle,
  isValidCarPlate,
} from "@/lib/formatters";
import { validateBirthDate } from "@/lib/validators";
import { CAMPUS_LIST } from "@/types/ride";
import type { Gender, ProfileUpdate } from "@/types/user";

type Preference = "passenger" | "driver" | "both";

interface FormState {
  course: string;
  birthDate: string;
  gender: Gender | "";
  preference: Preference | "";
  instagram: string;
  phone: string;
  photoUrl: string;
  bio: string;
  campuses: string[];
  carModel: string;
  carPlate: string;
  carColor: string;
}

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Masculino" },
  { value: "female", label: "Feminino" },
  { value: "other", label: "Outro" },
  { value: "prefer_not_to_say", label: "Prefiro não dizer" },
];

const PREFERENCE_OPTIONS: { value: Preference; label: string; description: string }[] = [
  { value: "driver", label: "Motorista", description: "Vou oferecer caronas" },
  { value: "passenger", label: "Passageiro", description: "Vou só pegar caronas" },
  { value: "both", label: "Ambos", description: "Vou oferecer e pegar caronas" },
];

export const ProfileCompletePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.has("edit");
  const navState = (location.state as { returnTo?: string; prefill?: unknown } | null) ?? null;

  const { user, setUser } = useAuthStore();

  const [form, setForm] = useState<FormState>(() => ({
    course: user?.course ?? "",
    birthDate: user?.birth_date ?? "",
    gender: user?.gender ?? "",
    preference: user ? (user.is_driver ? "both" : "passenger") : "",
    instagram: user?.instagram ?? user?.social_link ?? "",
    phone: user?.phone ?? "",
    photoUrl: user?.photo_url ?? "",
    bio: user?.bio ?? "",
    campuses: user?.campuses ?? [],
    carModel: user?.car_model ?? "",
    carPlate: user?.car_plate ?? "",
    carColor: user?.car_color ?? "",
  }));
  const [errors, setErrors] = useState<
    Partial<Record<"course" | "birthDate" | "gender" | "preference" | "carPlate", string>>
  >({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.profile_complete && !isEditMode) {
      navigate(navState?.returnTo || "/find", {
        replace: true,
        state: navState?.prefill,
      });
    }
  }, [user, isEditMode, navigate, navState]);

  const isDriver = useMemo(() => form.preference !== "passenger", [form.preference]);

  if (!user) return null;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleToggleCampus = (campusId: string) => {
    setForm((prev) => {
      const exists = prev.campuses.includes(campusId);
      const next = exists
        ? prev.campuses.filter((id) => id !== campusId)
        : [...prev.campuses, campusId];
      return { ...prev, campuses: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!form.course.trim()) nextErrors.course = "Informe seu curso.";
    const birthDateErr = validateBirthDate(form.birthDate);
    if (birthDateErr) nextErrors.birthDate = birthDateErr;
    if (!form.gender) nextErrors.gender = "Selecione seu gênero.";
    if (!form.preference) nextErrors.preference = "Selecione uma preferência.";
    if (isDriver && form.carPlate.trim()) {
      if (!isValidCarPlate(form.carPlate)) {
        nextErrors.carPlate = "Placa inválida. Use o formato ABC1234 ou ABC1C34 (letras A a J).";
      }
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setError("");
    setLoading(true);
    try {
      const formattedInsta = form.instagram.trim() ? formatSocialHandle(form.instagram) : undefined;
      const formattedPhone = form.phone.trim() ? formatPhone(form.phone) : undefined;
      const payload: ProfileUpdate = {
        course: form.course.trim(),
        birth_date: form.birthDate.trim(),
        gender: form.gender as Gender,
        instagram: formattedInsta,
        social_link: formattedInsta,
        phone: formattedPhone,
        photo_url: form.photoUrl.trim() || undefined,
        bio: form.bio.trim() || undefined,
        campuses: form.campuses.length > 0 ? form.campuses : undefined,
        is_driver: form.preference !== "passenger",
      };
      if (payload.is_driver) {
        payload.car_model = form.carModel.trim() || undefined;
        payload.car_plate = form.carPlate.trim() ? formatCarPlate(form.carPlate) : undefined;
        payload.car_color = form.carColor.trim() || undefined;
      }
      const { data } = await usersApi.updateMe(payload);
      setUser(data);
      navigate(isEditMode ? "/profile" : navState?.returnTo || "/find", {
        replace: true,
        state: navState?.prefill,
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro ao salvar o perfil."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center px-4 sm:px-6 pt-20 sm:pt-14 pb-20">
      <div className="w-full max-w-2xl rounded-3xl p-6 sm:p-10 border border-border bg-gradient-card shadow-lg animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
            Complete seu perfil
          </h1>
          <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
            Configure suas informações acadêmicas e preferências de viagem para começar a usar o Carona Aí.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Identity & Avatar */}
          <section className="p-5 rounded-2xl border border-border bg-surface-2 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="shrink-0 flex justify-center">
                <Avatar name={user.name} photoUrl={form.photoUrl.trim() || null} size="xl" ring />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5 text-center sm:text-left">
                <p className="text-base font-extrabold text-text truncate">
                  {user.name || "Estudante UFRGS"}
                </p>
                <p className="text-xs font-medium text-indigo-400 truncate">
                  {user.email}
                </p>
                <div className="pt-2">
                  <Input
                    label="URL da foto de perfil (opcional)"
                    placeholder="https://exemplo.com/sua-foto.jpg"
                    value={form.photoUrl}
                    onChange={(e) => setField("photoUrl", e.target.value)}
                    hint="Cole o link direto de uma imagem para personalizar seu avatar"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Academic & Personal Info */}
          <section className="space-y-5">
            <div className="border-b border-border pb-2">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-text">
                1. Vínculo Acadêmico e Dados Pessoais
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-5">
              <div className="sm:col-span-3">
                <CourseAutocomplete
                  value={form.course}
                  onChange={(val) => setField("course", val)}
                  error={errors.course}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <Input
                  label="Data de nascimento *"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setField("birthDate", e.target.value)}
                  error={errors.birthDate}
                  hint="Apenas sua idade aproximada é exibida."
                  required
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <span className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Gênero <span className="text-red-500">*</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GENDER_OPTIONS.map((opt) => {
                  const selected = form.gender === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-surface-2 text-text cursor-pointer transition text-sm ${
                        selected
                          ? "border-primary ring-2 ring-indigo-500/20"
                          : "border-border hover:border-border-strong"
                      }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        className="accent-indigo-500 w-4 h-4 shrink-0"
                        value={opt.value}
                        checked={selected}
                        onChange={() => setField("gender", opt.value)}
                      />
                      <span className="font-medium">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
              {errors.gender && <p className="text-xs text-red-500">{errors.gender}</p>}
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Campi que você frequenta (opcional)
                </span>
                <span className="text-xs text-text-muted">
                  Selecione um ou mais campi
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CAMPUS_LIST.map((c) => {
                  const selected = form.campuses.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-surface-2 cursor-pointer select-none transition ${
                        selected
                          ? "border-primary ring-2 ring-indigo-500/20"
                          : "border-border hover:border-border-strong"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-indigo-500 w-4 h-4 rounded shrink-0"
                        checked={selected}
                        onChange={() => handleToggleCampus(c.id)}
                      />
                      <span className="text-sm font-medium text-text">{c.shortName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Section 3: Ride Preferences & Vehicle */}
          <section className="space-y-5">
            <div className="border-b border-border pb-2">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-text">
                2. Como você pretende usar o aplicativo?
              </h2>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PREFERENCE_OPTIONS.map((opt) => {
                  const selected = form.preference === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-4 rounded-xl border bg-surface-2 cursor-pointer transition ${
                        selected
                          ? "border-primary ring-2 ring-indigo-500/20"
                          : "border-border hover:border-border-strong"
                      }`}
                    >
                      <input
                        type="radio"
                        name="preference"
                        className="accent-indigo-500 w-4 h-4 mt-0.5 shrink-0"
                        value={opt.value}
                        checked={selected}
                        onChange={() => setField("preference", opt.value)}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-text">{opt.label}</span>
                        <span className="text-xs text-text-muted leading-snug">{opt.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.preference && <p className="text-xs text-red-500">{errors.preference}</p>}
              <p className="text-xs text-text-muted">
                Você poderá alternar entre motorista e passageiro a qualquer momento no seu perfil.
              </p>
            </div>

            {isDriver && (
              <div className="rounded-2xl border border-dashed border-border-strong bg-indigo-500/5 p-5 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  Dados do seu veículo (opcional)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Modelo"
                    placeholder="Ex.: VW Gol 2022"
                    value={form.carModel}
                    onChange={(e) => setField("carModel", e.target.value)}
                  />
                  <Input
                    label="Cor"
                    placeholder="Ex.: Prata, Preto..."
                    value={form.carColor}
                    onChange={(e) => setField("carColor", e.target.value)}
                  />
                  <Input
                    label="Placa"
                    placeholder="ABC1234 ou ABC1C34"
                    maxLength={7}
                    value={form.carPlate}
                    onChange={(e) => setField("carPlate", formatCarPlate(e.target.value))}
                    error={errors.carPlate}
                    hint="Padrão antigo ou Mercosul"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Section 4: Contact & Bio */}
          <section className="space-y-5">
            <div className="border-b border-border pb-2">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-text">
                3. Contato e Apresentação (Opcional)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Telefone / WhatsApp"
                placeholder="(51) 99999-9999"
                type="tel"
                value={form.phone}
                onChange={(e) => setField("phone", formatPhone(e.target.value))}
                hint="Compartilhado apenas em caronas confirmadas"
              />
              <Input
                label="Instagram"
                placeholder="@seu_usuario"
                value={form.instagram}
                onChange={(e) => setField("instagram", e.target.value)}
                onBlur={() => {
                  if (form.instagram.trim()) {
                    setField("instagram", formatSocialHandle(form.instagram));
                  }
                }}
                hint="Exibido no seu perfil acadêmico"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="bio" className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Bio / Apresentação curta
                </label>
                <span className="text-xs text-text-muted">{form.bio.length}/250</span>
              </div>
              <textarea
                id="bio"
                rows={3}
                maxLength={250}
                placeholder="Conte um pouco sobre você (ex.: horários frequentes no campus do Vale, estilo de viagem, música favorita...)"
                value={form.bio}
                onChange={(e) => setField("bio", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface-2 text-text text-sm outline-none transition resize-none focus:border-primary focus:ring-3 focus:ring-indigo-500/20"
              />
            </div>
          </section>

          {error && (
            <div className="p-3.5 rounded-xl text-xs text-center border border-red-500/25 bg-red-500/10 text-danger">
              {error}
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" fullWidth loading={loading} size="lg">
              Concluir cadastro
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
