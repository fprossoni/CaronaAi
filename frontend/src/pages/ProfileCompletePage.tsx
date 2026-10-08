import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getErrorMessage } from "@/lib/errors";
import type { Gender, ProfileUpdate } from "@/types/user";
import styles from "./ProfileCompletePage.module.css";

type Preference = "passenger" | "driver" | "both";

interface FormState {
  course: string;
  gender: Gender | "";
  preference: Preference | "";
  social: string;
  phone: string;
  carModel: string;
  carPlate: string;
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
    carModel: user?.car_model ?? "",
    carPlate: user?.car_plate ?? "",
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
        is_driver: form.preference !== "passenger",
      };
      if (payload.is_driver) {
        payload.car_model = form.carModel.trim() || undefined;
        payload.car_plate = form.carPlate.trim() || undefined;
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
          </fieldset>

          <Input
            label="Redes sociais (opcional)"
            placeholder="https://instagram.com/seu.perfil"
            type="url"
            value={form.social}
            onChange={(e) => setField("social", e.target.value)}
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