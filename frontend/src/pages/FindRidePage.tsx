import React, { useState } from "react";
import { ridesApi } from "@/api/rides";
import type { RidePublic } from "@/types/ride";
import { UFRGS_CAMPUS } from "@/types/ride";
import { RideCard } from "@/components/rides/RideCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { matchesApi } from "@/api/matches";
import styles from "./FindRidePage.module.css";

export const FindRidePage: React.FC = () => {
  const [pickup, setPickup] = useState({ label: "", lat: "", lng: "" });
  const [rides, setRides] = useState<RidePublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [requestingId, setRequestingId] = useState<number | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(pickup.lat);
    const lng = parseFloat(pickup.lng);
    if (isNaN(lat) || isNaN(lng)) {
      setError("Insira coordenadas válidas ou selecione um campus.");
      return;
    }
    setError("");
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await ridesApi.search({
        pickup_lat: lat,
        pickup_lng: lng,
        pickup_label: pickup.label,
      });
      setRides(data);
    } catch {
      setError("Erro ao buscar caronas.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCampus = (campusId: string) => {
    const campus = UFRGS_CAMPUS.find((c) => c.id === campusId);
    if (campus) {
      setPickup({ label: campus.name, lat: String(campus.lat), lng: String(campus.lng) });
    }
  };

  const handleRequestMatch = async (ride: RidePublic) => {
    if (!pickup.lat || !pickup.lng) return;
    setRequestingId(ride.id);
    try {
      await matchesApi.request({
        ride_id: ride.id,
        pickup_lat: parseFloat(pickup.lat),
        pickup_lng: parseFloat(pickup.lng),
        pickup_label: pickup.label,
        pickup_region: pickup.label, // Simplified — in prod, use reverse geocoding
      });
      alert("Solicitação enviada! Aguarde a resposta do motorista.");
    } catch (err: any) {
      alert(err.response?.data?.detail ?? "Erro ao solicitar carona.");
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Pedir Carona</h2>
        <p className={styles.subtitle}>Encontre motoristas que passam perto de você</p>
      </div>

      <form onSubmit={handleSearch} className={styles.form}>
        {/* Campus shortcuts */}
        <div>
          <p className={styles.sectionLabel}>Atalhos — Campi da UFRGS</p>
          <div className={styles.campusGrid}>
            {UFRGS_CAMPUS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={[styles.campusBtn, pickup.label === c.name ? styles.campusBtnActive : ""].join(" ")}
                onClick={() => handleSelectCampus(c.id)}
              >
                {c.name.replace("Campus ", "")}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Local de embarque"
          placeholder="Ex: Rua dos Andradas, 1234"
          value={pickup.label}
          onChange={(e) => setPickup({ ...pickup, label: e.target.value })}
        />

        <div className={styles.coordRow}>
          <Input
            label="Latitude"
            type="number"
            step="any"
            placeholder="-30.0349"
            value={pickup.lat}
            onChange={(e) => setPickup({ ...pickup, lat: e.target.value })}
          />
          <Input
            label="Longitude"
            type="number"
            step="any"
            placeholder="-51.2177"
            value={pickup.lng}
            onChange={(e) => setPickup({ ...pickup, lng: e.target.value })}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <Button type="submit" fullWidth loading={loading}>
          🔍 Buscar Caronas
        </Button>
      </form>

      {searched && !loading && (
        <div className={styles.results}>
          {rides.length === 0 ? (
            <div className={styles.empty}>
              <p>😔 Nenhuma carona encontrada com menos de 3 km de desvio.</p>
              <p className={styles.emptyHint}>Tente um ponto de embarque diferente.</p>
            </div>
          ) : (
            <>
              <p className={styles.resultsLabel}>
                {rides.length} {rides.length === 1 ? "carona disponível" : "caronas disponíveis"}, ordenadas por menor desvio
              </p>
              {rides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  onRequestMatch={requestingId === null ? handleRequestMatch : undefined}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
