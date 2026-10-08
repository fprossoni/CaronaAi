import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ridesApi } from "@/api/rides";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getErrorMessage } from "@/lib/errors";
import { UFRGS_CAMPUS } from "@/types/ride";
import styles from "./OfferRidePage.module.css";

export const OfferRidePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    origin_label: "",
    origin_lat: "",
    origin_lng: "",
    destination_label: "",
    destination_lat: "",
    destination_lng: "",
    campus_point: UFRGS_CAMPUS[0].id,
    departure_at: "",
    delay_tolerance_minutes: 15,
    total_seats: 4,
    women_only: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSetCampus = (type: "origin" | "destination") => {
    const campus = UFRGS_CAMPUS.find((c) => c.id === formData.campus_point);
    if (!campus) return;
    
    if (type === "origin") {
      setFormData((prev) => ({
        ...prev,
        origin_label: campus.name,
        origin_lat: String(campus.lat),
        origin_lng: String(campus.lng),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        destination_label: campus.name,
        destination_lat: String(campus.lat),
        destination_lng: String(campus.lng),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        ...formData,
        origin_lat: parseFloat(formData.origin_lat),
        origin_lng: parseFloat(formData.origin_lng),
        destination_lat: parseFloat(formData.destination_lat),
        destination_lng: parseFloat(formData.destination_lng),
        departure_at: new Date(formData.departure_at).toISOString(),
      };

      if (isNaN(payload.origin_lat) || isNaN(payload.origin_lng) || isNaN(payload.destination_lat) || isNaN(payload.destination_lng)) {
        throw new Error("As coordenadas devem ser numéricas válidas.");
      }

      await ridesApi.create(payload);
      alert("Carona oferecida com sucesso!");
      navigate("/rides");
} catch (err: unknown) {
      setError(getErrorMessage(err, "Erro ao oferecer carona. Verifique os dados."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Oferecer Carona</h2>
        <p className={styles.subtitle}>Compartilhe sua rota e economize</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Campus Relacionado</label>
          <select
            name="campus_point"
            value={formData.campus_point}
            onChange={handleChange}
            className={styles.select}
          >
            {UFRGS_CAMPUS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <label className={styles.sectionLabel}>Origem</label>
            <button type="button" onClick={() => handleSetCampus("origin")} className={styles.shortcutBtn}>
              Usar Campus
            </button>
          </div>
          <Input
            label="Endereço de Saída"
            name="origin_label"
            value={formData.origin_label}
            onChange={handleChange}
            placeholder="Ex: Rua João Pessoa, 123"
            required
          />
          <div className={styles.coordRow}>
            <Input label="Lat" name="origin_lat" type="number" step="any" value={formData.origin_lat} onChange={handleChange} required />
            <Input label="Lng" name="origin_lng" type="number" step="any" value={formData.origin_lng} onChange={handleChange} required />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <label className={styles.sectionLabel}>Destino</label>
            <button type="button" onClick={() => handleSetCampus("destination")} className={styles.shortcutBtn}>
              Usar Campus
            </button>
          </div>
          <Input
            label="Endereço de Chegada"
            name="destination_label"
            value={formData.destination_label}
            onChange={handleChange}
            placeholder="Ex: UFRGS Campus do Vale"
            required
          />
          <div className={styles.coordRow}>
            <Input label="Lat" name="destination_lat" type="number" step="any" value={formData.destination_lat} onChange={handleChange} required />
            <Input label="Lng" name="destination_lng" type="number" step="any" value={formData.destination_lng} onChange={handleChange} required />
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.sectionLabel}>Detalhes da Viagem</label>
          <Input
            label="Horário de Saída"
            name="departure_at"
            type="datetime-local"
            value={formData.departure_at}
            onChange={handleChange}
            required
          />
          <div className={styles.coordRow}>
            <Input
              label="Assentos Livres"
              name="total_seats"
              type="number"
              min="1"
              max="6"
              value={formData.total_seats}
              onChange={handleChange}
              required
            />
            <Input
              label="Tolerância (min)"
              name="delay_tolerance_minutes"
              type="number"
              min="0"
              max="60"
              value={formData.delay_tolerance_minutes}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="women_only"
            checked={formData.women_only}
            onChange={handleChange}
          />
          Carona apenas para mulheres
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <Button type="submit" fullWidth loading={loading}>
          🚗 Publicar Carona
        </Button>
      </form>
    </div>
  );
};
