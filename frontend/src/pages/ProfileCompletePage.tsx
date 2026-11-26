import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usersApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { Avatar } from "@/components/ui/Avatar";
import { KineticChevrons } from "@/components/ui/BrandMotifs";
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
  name: string;
  course: string;
  birthDate: string;
  gender: Gender | "";
  preference: Preference | "";
  instagram: string;
  phone: string;
  photoUrl: string;
  bio: string;
  campuses: string[];
  carBrand: string;
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
  { value: "driver", label: "Motorista", description: "Oferecer caronas" },
  { value: "passenger", label: "Passageiro", description: "Pedir caronas" },
  { value: "both", label: "Ambos", description: "Oferecer e pedir" },
];

export const ProfileCompletePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.has("edit");
  const navState = (location.state as { returnTo?: string; prefill?: unknown } | null) ?? null;

  const { user, setUser } = useAuthStore();

  const [form, setForm] = useState<FormState>(() => ({
    name: user?.name ?? "",
    course: user?.course ?? "",
    birthDate: user?.birth_date ?? "",
    gender: user?.gender ?? "",
    preference: user ? (user.is_driver ? "both" : "passenger") : "",
    instagram: user?.instagram ?? user?.social_link ?? "",
    phone: user?.phone ?? "",
    photoUrl: user?.photo_url ?? "",
    bio: user?.bio ?? "",
    campuses: user?.campuses ?? [],
    carBrand: user?.car_brand ?? "",
    carModel: user?.car_model ?? "",
    carPlate: user?.car_plate ?? "",
    carColor: user?.car_color ?? "",
  }));
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
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
    if (!form.name.trim()) nextErrors.name = "Informe seu nome.";
    if (!form.course.trim()) nextErrors.course = "Informe seu curso.";
    const birthDateErr = validateBirthDate(form.birthDate);
    if (birthDateErr) nextErrors.birthDate = birthDateErr;
    if (!form.gender) nextErrors.gender = "Selecione seu gênero.";
    if (!form.preference) nextErrors.preference = "Selecione uma modalidade.";
    if (!form.phone.trim()) nextErrors.phone = "Informe seu telefone com DDD.";
    if (isDriver) {
      if (!form.carBrand.trim()) nextErrors.carBrand = "Informe a marca.";
      if (!form.carModel.trim()) nextErrors.carModel = "Informe o modelo.";
      if (!form.carColor.trim()) nextErrors.carColor = "Informe a cor.";
      if (!form.carPlate.trim()) nextErrors.carPlate = "Informe a placa.";
      if (!isValidCarPlate(form.carPlate)) {
        nextErrors.carPlate = "Formato inválido (ABC1234 ou ABC1C34).";
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
        name: form.name.trim(),
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
        payload.car_brand = form.carBrand.trim();
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
    <div className="min-h-screen flex items-start justify-center px-4 sm:px-6 pt-18 sm:pt-12 pb-16">
      <div className="w-full max-w-2xl rounded-[10px] p-6 sm:p-8 border border-border-strong bg-surface shadow-lg animate-fade-in">
        <div className="mb-7 pb-4 border-b border-border flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">
            Completar perfil
          </h1>
          <span className="font-mono text-[11px] uppercase tracking-wider text-accent-text">
            UFRGS
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">
          <Input label="Nome completo" value={form.name} onChange={(e) => setField("name", e.target.value)} error={errors.name} required />
          <section className="p-4 rounded-md border border-border bg-surface-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="shrink-0 flex justify-center">
                <Avatar name={user.name} photoUrl={form.photoUrl.trim() || null} size="xl" ring />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="text-center sm:text-left">
                  <p className="text-sm font-bold text-text truncate">
                    {user.name || "Estudante UFRGS"}
                  </p>
                  <p className="font-mono text-xs text-accent-text truncate">
                    {user.email}
                  </p>
                </div>
                <Input
                  label="URL da foto (opcional)"
                  placeholder="https://..."
                  value={form.photoUrl}
                  onChange={(e) => setField("photoUrl", e.target.value)}
                />
              </div>
            </div>
          </section>
          <section className="space-y-4">
            <div className="border-b border-border pb-2">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-accent-text">
                01 · ACADÊMICO
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
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
                  label="Nascimento *"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setField("birthDate", e.target.value)}
                  error={errors.birthDate}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Gênero <span className="text-danger">*</span>
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                {GENDER_OPTIONS.map((opt) => {
                  const selected = form.gender === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-md border bg-surface-2 text-text cursor-pointer transition-colors text-sm ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-border-strong"
                      }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        className="accent-primary w-4 h-4 shrink-0"
                        value={opt.value}
                        checked={selected}
                        onChange={() => setField("gender", opt.value)}
                      />
                      <span className="font-medium text-xs sm:text-sm">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
              {errors.gender && <p className="text-xs text-danger">{errors.gender}</p>}
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Campi frequentados (opcional)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CAMPUS_LIST.map((c) => {
                  const selected = form.campuses.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border bg-surface-2 cursor-pointer select-none transition-colors ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-border-strong"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary w-3.5 h-3.5 rounded-[2px] shrink-0"
                        checked={selected}
                        onChange={() => handleToggleCampus(c.id)}
                      />
                      <span className="text-xs font-medium text-text truncate">{c.shortName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
          <section className="space-y-4">
            <div className="border-b border-border pb-2">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-accent-text">
                02 · MODALIDADE
              </h2>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {PREFERENCE_OPTIONS.map((opt) => {
                  const selected = form.preference === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-2.5 p-3.5 rounded-md border bg-surface-2 cursor-pointer transition-colors ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-border-strong"
                      }`}
                    >
                      <input
                        type="radio"
                        name="preference"
                        className="accent-primary w-4 h-4 mt-0.5 shrink-0"
                        value={opt.value}
                        checked={selected}
                        onChange={() => setField("preference", opt.value)}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-text">{opt.label}</span>
                        <span className="text-xs text-text-muted">{opt.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.preference && <p className="text-xs text-danger">{errors.preference}</p>}
            </div>

            {isDriver && (
              <div className="rounded-md border border-dashed border-border-strong bg-surface-2 p-4 space-y-3">
                <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-accent-text">
                  Veículo (obrigatório para motoristas)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Marca" placeholder="Volkswagen" value={form.carBrand} onChange={(e) => setField("carBrand", e.target.value)} error={errors.carBrand} required />
                  <Input
                    required
                    error={errors.carModel}
                    label="Modelo"
                    placeholder="Gol 2022"
                    value={form.carModel}
                    onChange={(e) => setField("carModel", e.target.value)}
                  />
                  <Input
                    required
                    error={errors.carColor}
                    label="Cor"
                    placeholder="Prata"
                    value={form.carColor}
                    onChange={(e) => setField("carColor", e.target.value)}
                  />
                  <Input
                    required
                    label="Placa"
                    placeholder="ABC1C34"
                    maxLength={7}
                    value={form.carPlate}
                    onChange={(e) => setField("carPlate", formatCarPlate(e.target.value))}
                    error={errors.carPlate}
                  />
                </div>
              </div>
            )}
          </section>
          <section className="space-y-4">
            <div className="border-b border-border pb-2">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-accent-text">
                03 · CONTATO
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                required
                error={errors.phone}
                hint="Compartilhado apenas após a confirmação da carona."
                label="WhatsApp"
                placeholder="(51) 99999-9999"
                type="tel"
                value={form.phone}
                onChange={(e) => setField("phone", formatPhone(e.target.value))}
              />
              <Input
                label="Instagram"
                placeholder="@usuario"
                value={form.instagram}
                onChange={(e) => setField("instagram", e.target.value)}
                onBlur={() => {
                  if (form.instagram.trim()) {
                    setField("instagram", formatSocialHandle(form.instagram));
                  }
                }}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="bio" className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Bio
                </label>
                <span className="font-mono text-[11px] text-text-muted">{form.bio.length}/250</span>
              </div>
              <textarea
                id="bio"
                rows={3}
                maxLength={250}
                placeholder="Horários habituais, campus, preferências..."
                value={form.bio}
                onChange={(e) => setField("bio", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-md border border-border bg-surface-2 text-text text-sm outline-none transition-colors resize-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </section>

          {error && (
            <div className="p-3 rounded-md text-xs text-center border border-danger/30 bg-danger/10 text-danger">
              {error}
            </div>
          )}

          <Button type="submit" fullWidth loading={loading} size="lg">
            <span>Concluir cadastro</span>
            <KineticChevrons />
          </Button>
        </form>
      </div>
    </div>
  );
};
