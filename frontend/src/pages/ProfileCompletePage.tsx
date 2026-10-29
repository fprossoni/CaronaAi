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
import { UFRGS_CAMPUS } from "@/types/ride";
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
    <div className="min-h-screen flex items-start justify-center p-4 sm:p-6 pt-8 pb-16">
      <div
        className="w-full max-w-lg rounded-3xl p-6 sm:p-8 border shadow-2xl animate-fade-in"
        style={{
          background: "var(--gradient-card)",
          borderColor: "var(--color-border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="text-center mb-6">
          <h1
            className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            Complete seu perfil
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Só mais algumas informações para terminar seu cadastro.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div
            className="flex items-center gap-4 p-4 rounded-2xl border"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
          >
            <div className="shrink-0">
              <Avatar name={user.name} photoUrl={form.photoUrl.trim() || null} size="lg" />
            </div>
            <div className="flex-1 min-w-0">
              <Input
                label="Foto de perfil (opcional)"
                placeholder="https://exemplo.com/sua-foto.jpg"
                value={form.photoUrl}
                onChange={(e) => setField("photoUrl", e.target.value)}
                hint="Link direto para uma foto sua"
              />
            </div>
          </div>

          <Input label="Nome" value={user.name ?? ""} disabled />
          <Input label="E-mail institucional" value={user.email} disabled />

          <CourseAutocomplete
            value={form.course}
            onChange={(val) => setField("course", val)}
            error={errors.course}
            required
          />

          <Input
            label="Data de nascimento"
            type="date"
            value={form.birthDate}
            onChange={(e) => setField("birthDate", e.target.value)}
            error={errors.birthDate}
            hint="Apenas sua idade aproximada é exibida nos perfis; a data exata permanece privada."
            required
          />

          <fieldset className="border-0 p-0 m-0 flex flex-col gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>
              Campi que você frequenta (opcional)
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {UFRGS_CAMPUS.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: form.campuses.includes(c.id) ? "var(--color-primary)" : "var(--color-border)",
                    boxShadow: form.campuses.includes(c.id) ? "0 0 0 2px rgba(99, 102, 241, 0.2)" : "none",
                  }}
                >
                  <input
                    type="checkbox"
                    className="accent-indigo-500 w-4 h-4 rounded"
                    checked={form.campuses.includes(c.id)}
                    onChange={() => handleToggleCampus(c.id)}
                  />
                  <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{c.shortName}</span>
                </label>
              ))}
            </div>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Você pode selecionar mais de um campus.</p>
          </fieldset>

          <fieldset className="border-0 p-0 m-0 flex flex-col gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>
              Gênero <span className="text-red-500">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {GENDER_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition text-sm"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: form.gender === opt.value ? "var(--color-primary)" : "var(--color-border)",
                    boxShadow: form.gender === opt.value ? "0 0 0 2px rgba(99, 102, 241, 0.2)" : "none",
                    color: "var(--color-text)",
                  }}
                >
                  <input
                    type="radio"
                    name="gender"
                    className="accent-indigo-500 w-4 h-4"
                    value={opt.value}
                    checked={form.gender === opt.value}
                    onChange={() => setField("gender", opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            {errors.gender && <p className="text-xs text-red-500">{errors.gender}</p>}
          </fieldset>

          <fieldset className="border-0 p-0 m-0 flex flex-col gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>
              Preferência inicial <span className="text-red-500">*</span>
            </legend>
            <div className="flex flex-col gap-2">
              {PREFERENCE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: form.preference === opt.value ? "var(--color-primary)" : "var(--color-border)",
                    boxShadow: form.preference === opt.value ? "0 0 0 2px rgba(99, 102, 241, 0.2)" : "none",
                  }}
                >
                  <input
                    type="radio"
                    name="preference"
                    className="accent-indigo-500 w-4 h-4 mt-1"
                    value={opt.value}
                    checked={form.preference === opt.value}
                    onChange={() => setField("preference", opt.value)}
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{opt.label}</span>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.preference && <p className="text-xs text-red-500">{errors.preference}</p>}
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Você poderá alterar sua preferência (motorista / passageiro) a qualquer momento no seu perfil.
            </p>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="bio" className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                Bio / Apresentação curta (opcional)
              </label>
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{form.bio.length}/250</span>
            </div>
            <textarea
              id="bio"
              rows={3}
              maxLength={250}
              placeholder="Conte um pouco sobre você (ex.: horários frequentes no campus do Vale, estilo de viagem, música favorita...)"
              value={form.bio}
              onChange={(e) => setField("bio", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition resize-none focus:ring-2 focus:ring-indigo-500/30"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <Input
            label="Instagram (opcional)"
            placeholder="@seu_usuario"
            value={form.instagram}
            onChange={(e) => setField("instagram", e.target.value)}
            onBlur={() => {
              if (form.instagram.trim()) {
                setField("instagram", formatSocialHandle(form.instagram));
              }
            }}
            hint="Digite seu @usuario ou link do Instagram"
          />
          <Input
            label="Telefone / WhatsApp (opcional)"
            placeholder="(51) 99999-9999"
            type="tel"
            value={form.phone}
            onChange={(e) => setField("phone", formatPhone(e.target.value))}
          />

          {isDriver && (
            <div
              className="rounded-2xl border border-dashed p-4 flex flex-col gap-3"
              style={{
                borderColor: "var(--color-border)",
                background: "rgba(99, 102, 241, 0.05)",
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text)" }}>
                Dados do seu veículo (opcional)
              </p>
              <Input
                label="Modelo"
                placeholder="Ex.: Volkswagen Gol 2022"
                value={form.carModel}
                onChange={(e) => setField("carModel", e.target.value)}
              />
              <Input
                label="Cor"
                placeholder="Ex.: Prata, Preto, Branco..."
                value={form.carColor}
                onChange={(e) => setField("carColor", e.target.value)}
              />
              <Input
                label="Placa"
                placeholder="Ex.: ABC1234 ou ABC1C34"
                maxLength={7}
                value={form.carPlate}
                onChange={(e) => setField("carPlate", formatCarPlate(e.target.value))}
                error={errors.carPlate}
                hint="Formatos: ABC1234 ou ABC1C34 (letras A a J)"
              />
            </div>
          )}

          {error && (
            <div
              className="p-3 rounded-xl text-xs text-center border"
              style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.25)", color: "var(--color-danger)" }}
            >
              {error}
            </div>
          )}

          <Button type="submit" fullWidth loading={loading} size="lg">
            Concluir cadastro
          </Button>
        </form>
      </div>
    </div>
  );
};