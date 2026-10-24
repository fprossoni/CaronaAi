import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ridesApi } from "@/api/rides";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AddressSelector, type SelectedAddressValue } from "@/components/address/AddressSelector";
import { getErrorMessage } from "@/lib/errors";
import { UFRGS_CAMPUS, type CampusId } from "@/types/ride";
import styles from "./OfferRidePage.module.css";

export const OfferRidePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [direction, setDirection] = useState<"to_campus" | "from_campus">("to_campus");
  const [campusPoint, setCampusPoint] = useState<CampusId>(UFRGS_CAMPUS[0].id);

  const [addressValue, setAddressValue] = useState<SelectedAddressValue>({
    type: "saved",
  });

  const [details, setDetails] = useState({
    departure_at: "",
    delay_tolerance_minutes: 15,
    total_seats: 3,
    women_only: false,
  });

  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setDetails((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!details.departure_at) {
      setError("Por favor, selecione a data e o horário de saída.");
      return;
    }

    if (addressValue.type === "saved" && !addressValue.addressId) {
      setError("Por favor, selecione um endereço salvo ou cadastre um novo.");
      return;
    }

    if (addressValue.type === "custom") {
      const c = addressValue.custom;
      if (!c || !c.street || !c.number || !c.postal_code || !c.city) {
        setError("Por favor, preencha rua, número, CEP e cidade do seu endereço.");
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        campus_point: campusPoint,
        direction,
        address_id: addressValue.type === "saved" ? addressValue.addressId : undefined,
        custom_address: addressValue.type === "custom" ? addressValue.custom : undefined,
        save_address: addressValue.type === "custom" ? (addressValue.saveAddress ?? true) : undefined,
        departure_at: new Date(details.departure_at).toISOString(),
        delay_tolerance_minutes: Number(details.delay_tolerance_minutes),
        total_seats: Number(details.total_seats),
        women_only: details.women_only,
      };

      await ridesApi.create(payload);
      alert("Carona publicada com sucesso! Ela já está disponível para matching com estudantes.");
      navigate("/rides");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro ao publicar carona. Verifique os dados inseridos."));
    } finally {
      setLoading(false);
    }
  };

  const selectedCampus = UFRGS_CAMPUS.find((c) => c.id === campusPoint);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Oferecer Carona</h2>
        <p className={styles.subtitle}>
          Conecte sua rota diária a um dos campi da UFRGS e ajude outros estudantes
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Sentido da Viagem */}
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Sentido da Viagem</label>
          <div className={styles.directionToggle}>
            <button
              type="button"
              className={[
                styles.directionBtn,
                direction === "to_campus" ? styles.directionBtnActive : "",
              ].join(" ")}
              onClick={() => setDirection("to_campus")}
            >
              <span className={styles.directionIcon}>🎓</span>
              <div>
                <strong>Indo para a UFRGS</strong>
                <p>Do seu endereço pessoal para o campus</p>
              </div>
            </button>

            <button
              type="button"
              className={[
                styles.directionBtn,
                direction === "from_campus" ? styles.directionBtnActive : "",
              ].join(" ")}
              onClick={() => setDirection("from_campus")}
            >
              <span className={styles.directionIcon}>🏠</span>
              <div>
                <strong>Saindo da UFRGS</strong>
                <p>Do campus de volta para seu destino</p>
              </div>
            </button>
          </div>
        </div>

        {/* Campus da UFRGS */}
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Campus da UFRGS</label>
          <div className={styles.campusGrid}>
            {UFRGS_CAMPUS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={[
                  styles.campusCard,
                  campusPoint === c.id ? styles.campusCardActive : "",
                ].join(" ")}
                onClick={() => setCampusPoint(c.id)}
              >
                <span className={styles.campusDot}>●</span>
                <span className={styles.campusName}>{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Endereço Pessoal (Origem se to_campus, Destino se from_campus) */}
        <div className={styles.section}>
          <AddressSelector
            label={
              direction === "to_campus"
                ? "Ponto de Partida (Seu Endereço)"
                : "Ponto de Chegada (Seu Endereço)"
            }
            value={addressValue}
            onChange={setAddressValue}
            required
          />
        </div>

        {/* Resumo da Rota Selecionada */}
        <div className={styles.routeSummary}>
          <div className={styles.summaryStep}>
            <span className={styles.stepBadge}>Origem</span>
            <span className={styles.stepText}>
              {direction === "to_campus"
                ? "Seu Endereço Pessoal (Privado)"
                : selectedCampus?.name ?? "Campus UFRGS"}
            </span>
          </div>
          <span className={styles.summaryArrow}>➔</span>
          <div className={styles.summaryStep}>
            <span className={styles.stepBadge}>Destino</span>
            <span className={styles.stepText}>
              {direction === "to_campus"
                ? selectedCampus?.name ?? "Campus UFRGS"
                : "Seu Endereço Pessoal (Privado)"}
            </span>
          </div>
        </div>

        {/* Detalhes da Viagem */}
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Detalhes do Trajeto</label>
          <Input
            label="Data e Horário de Saída"
            name="departure_at"
            type="datetime-local"
            value={details.departure_at}
            onChange={handleDetailChange}
            required
          />
          <div className={styles.rowTwo}>
            <Input
              label="Assentos Disponíveis"
              name="total_seats"
              type="number"
              min="1"
              max="6"
              value={details.total_seats}
              onChange={handleDetailChange}
              required
            />
            <Input
              label="Tolerância de Atraso (min)"
              name="delay_tolerance_minutes"
              type="number"
              min="0"
              max="60"
              value={details.delay_tolerance_minutes}
              onChange={handleDetailChange}
              required
            />
          </div>
        </div>

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="women_only"
            checked={details.women_only}
            onChange={handleDetailChange}
          />
          <span>Carona apenas para mulheres</span>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <Button type="submit" fullWidth loading={loading}>
          🚗 Publicar Carona
        </Button>
      </form>
    </div>
  );
};
