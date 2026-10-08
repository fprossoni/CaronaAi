import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getErrorMessage } from "@/lib/errors";
import { UFRGS_CAMPUS } from "@/types/ride";
import type { Gender, ProfileUpdate } from "@/types/user";
import styles from "./ProfileCompletePage.module.css";

type Preference = "passenger" | "driver" | "both";

interface FormState {
  course: string;
  gender: Gender | "";
  preference: Preference | "";
  social: string;
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
  const { user, setUser } = useAuthStore();

  const [form, setForm] = useState<FormState>(() => ({
    course: user?.course ?? "",
    gender: user?.gender ?? "",
    preference: user ? (user.is_driver ? "both" : "passenger") : "",
    social: user?.social_link ?? "",
    phone: user?.phone ?? "",
    photoUrl: user?.photo_url ?? "",
    bio: user?.bio ?? "",
    campuses: user?.campuses ?? [],
    carModel: user?.car_model ?? "",
    carPlate: user?.car_plate ?? "",
    carColor: user?.car_color ?? "",
  }));
  const [errors, setErrors] = useState<Partial<Record<"course" | "gender" | "preference", string>>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.profile_complete) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

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
    if (!form.gender) nextErrors.gender = "Selecione seu gênero.";
    if (!form.preference) nextErrors.preference = "Selecione uma preferência.";
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setError("");
    setLoading(true);
    try {
      const payload: ProfileUpdate = {
        course: form.course.trim(),
        gender: form.gender as Gender,
        social_link: form.social.trim() || undefined,
        phone: form.phone.trim() || undefined,
        photo_url: form.photoUrl.trim() || undefined,
        bio: form.bio.trim() || undefined,
        campuses: form.campuses.length > 0 ? form.campuses : undefined,
        is_driver: form.preference !== "passenger",
      };
      if (payload.is_driver) {
        payload.car_model = form.carModel.trim() || undefined;
        payload.car_plate = form.carPlate.trim() || undefined;
        payload.car_color = form.carColor.trim() || undefined;
      }
      const { data } = await usersApi.updateMe(payload);
      setUser(data);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro ao salvar o perfil."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>✨</div>
        <h1 className={styles.title}>Complete seu perfil</h1>
        <p className={styles.subtitle}>Só mais algumas informações para terminar seu cadastro.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.avatarSection}>
            <div className={styles.avatarWrap}>
              <Avatar name={user.name} photoUrl={form.photoUrl.trim() || null} size="lg" />
            </div>
            <div style={{ flex: 1 }}>
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

          <Input
            label="Curso"
            placeholder="Ex.: Engenharia da Computação"
            value={form.course}
            onChange={(e) => setField("course", e.target.value)}
            error={errors.course}
            required
          />

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Campi que você frequenta (opcional)</legend>
            <div className={styles.checkboxGrid}>
              {UFRGS_CAMPUS.map((c) => (
                <label key={c.id} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.campuses.includes(c.id)}
                    onChange={() => handleToggleCampus(c.id)}
                  />
                  <span>{c.shortName}</span>
                </label>
              ))}
            </div>
            <p className={styles.helperText}>Você pode selecionar mais de um campus.</p>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Gênero <span className={styles.req}>*</span></legend>
            <div className={styles.radioGroup}>
              {GENDER_OPTIONS.map((opt) => (
                <label key={opt.value} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="gender"
                    value={opt.value}
                    checked={form.gender === opt.value}
                    onChange={() => setField("gender", opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            {errors.gender && <p className={styles.fieldError}>{errors.gender}</p>}
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Preferência <span className={styles.req}>*</span></legend>
            <div className={styles.radioGroup}>
              {PREFERENCE_OPTIONS.map((opt) => (
                <label key={opt.value} className={styles.radioRow}>
                  <input
                    type="radio"
                    name="preference"
                    value={opt.value}
                    checked={form.preference === opt.value}
                    onChange={() => setField("preference", opt.value)}
                  />
                  <span className={styles.radioText}>
                    <span className={styles.radioTitle}>{opt.label}</span>
                    <span className={styles.radioDesc}>{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.preference && <p className={styles.fieldError}>{errors.preference}</p>}
            <p className={styles.infoNote}>
              💡 Você poderá alterar sua preferência (motorista / passageiro) a qualquer momento no seu perfil.
            </p>
          </fieldset>

          <div className={styles.textareaWrap}>
            <label className={styles.legend} htmlFor="bio">
              Bio / Apresentação curta (opcional)
            </label>
            <textarea
              id="bio"
              className={styles.textarea}
              rows={3}
              maxLength={250}
              placeholder="Conte um pouco sobre você (ex.: horários frequentes, estilo de viagem...)"
              value={form.bio}
              onChange={(e) => setField("bio", e.target.value)}
            />
            <span className={styles.charCount}>{form.bio.length}/250</span>
          </div>

          <Input
            label="Redes sociais (opcional)"
            placeholder="@seu_usuario"
            value={form.social}
            onChange={(e) => setField("social", e.target.value)}
            hint="Informe seu @ do Instagram/Twitter ou o link do perfil"
          />
          <Input
            label="Telefone (opcional)"
            placeholder="(51) 99999-9999"
            type="tel"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
          />

          {isDriver && (
            <div className={styles.carSection}>
              <p className={styles.carTitle}>Dados do seu carro (opcional)</p>
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
                placeholder="ABC1D23"
                value={form.carPlate}
                onChange={(e) => setField("carPlate", e.target.value)}
              />
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <Button type="submit" fullWidth loading={loading}>
            Concluir cadastro
          </Button>
        </form>
      </div>
    </div>
  );
};