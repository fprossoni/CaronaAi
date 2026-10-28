import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ridesApi } from "@/api/rides";
import { addressesApi } from "@/api/addresses";
import type { RidePublic } from "@/types/ride";
import { UFRGS_CAMPUS, type CampusId } from "@/types/ride";
import { RideCard } from "@/components/rides/RideCard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { AddressSelector, type SelectedAddressValue } from "@/components/address/AddressSelector";
import { matchesApi } from "@/api/matches";
import { getErrorMessage } from "@/lib/errors";
import styles from "./FindRidePage.module.css";

interface BatchFeedback {
  sent: number;
  skipped: { ride_id: number; reason: string }[];
}

/** Optional pre-selection coming from the home page search bar. */
interface FindRideLocationState {
  campus?: CampusId;
  direction?: "to_campus" | "from_campus";
}

export const FindRidePage: React.FC = () => {
  const prefill = (useLocation().state ?? {}) as FindRideLocationState;
  const [direction, setDirection] = useState<"to_campus" | "from_campus">(prefill.direction ?? "to_campus");
  const [campusPoint, setCampusPoint] = useState<CampusId>(
    prefill.campus && UFRGS_CAMPUS.some((c) => c.id === prefill.campus) ? prefill.campus : UFRGS_CAMPUS[0].id
  );

  const [addressValue, setAddressValue] = useState<SelectedAddressValue>({
    type: "saved",
  });

  const [resolvedCoords, setResolvedCoords] = useState<{
    pickup_lat: number;
    pickup_lng: number;
    pickup_label: string;
    pickup_region: string;
    dropoff_lat?: number;
    dropoff_lng?: number;
  } | null>(null);

  const [rides, setRides] = useState<RidePublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<BatchFeedback | null>(null);

  const selectableRides = useMemo(() => rides.filter((r) => !r.my_match_status), [rides]);
  const alreadyRequested = rides.length - selectableRides.length;
  const allSelected = selectableRides.length > 0 && selectableRides.every((r) => selected.has(r.id));

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFeedback(null);
    setSelected(new Set());

    const campus = UFRGS_CAMPUS.find((c) => c.id === campusPoint) || UFRGS_CAMPUS[0];

    // Valida endereço
    if (addressValue.type === "saved" && !addressValue.addressId) {
      setError("Selecione um endereço salvo ou cadastre um novo endereço.");
      return;
    }
    if (addressValue.type === "custom") {
      const c = addressValue.custom;
      if (!c || !c.street || !c.number || !c.postal_code || !c.city) {
        setError("Preencha rua, número, CEP e cidade do seu endereço.");
        return;
      }
    }

    setLoading(true);
    setSearched(true);

    try {
      let lat = 0;
      let lng = 0;
      let label = "";
      let region = "";

      if (addressValue.type === "saved" && addressValue.addressId) {
        // Busca direta pelo address_id do usuário salvo
        const res = await ridesApi.search({
          address_id: addressValue.addressId,
        });
        setRides(res.data);

        // Guarda as coordenadas para posterior envio de match
        // Obtemos os dados do endereço salvo
        const addrList = await addressesApi.list();
        const found = addrList.data.find((a) => a.id === addressValue.addressId);
        if (found) {
          lat = found.lat;
          lng = found.lng;
          label = `${found.street}, ${found.number}`;
          region = found.neighborhood ? `${found.neighborhood}, ${found.city}` : found.city;
        }
      } else if (addressValue.type === "custom" && addressValue.custom) {
        // Geocodifica transparentemente o endereço novo
        const geoRes = await addressesApi.geocode({
          street: addressValue.custom.street,
          number: addressValue.custom.number,
          city: addressValue.custom.city,
          state: addressValue.custom.state,
          postal_code: addressValue.custom.postal_code,
          country: addressValue.custom.country,
        });

        lat = geoRes.data.lat;
        lng = geoRes.data.lng;
        label = `${addressValue.custom.street}, ${addressValue.custom.number}`;
        region = addressValue.custom.neighborhood
          ? `${addressValue.custom.neighborhood}, ${addressValue.custom.city}`
          : addressValue.custom.city;

        const res = await ridesApi.search({
          pickup_lat: direction === "to_campus" ? lat : campus.lat,
          pickup_lng: direction === "to_campus" ? lng : campus.lng,
          pickup_label: direction === "to_campus" ? label : campus.name,
          dropoff_lat: direction === "to_campus" ? campus.lat : lat,
          dropoff_lng: direction === "to_campus" ? campus.lng : lng,
        });
        setRides(res.data);
      }

      setResolvedCoords({
        pickup_lat: direction === "to_campus" ? lat : campus.lat,
        pickup_lng: direction === "to_campus" ? lng : campus.lng,
        pickup_label: direction === "to_campus" ? label : campus.name,
        pickup_region: direction === "to_campus" ? region : campus.shortName,
        dropoff_lat: direction === "to_campus" ? campus.lat : lat,
        dropoff_lng: direction === "to_campus" ? campus.lng : lng,
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro ao buscar caronas disponíveis."));
    } finally {
      setLoading(false);
    }
  };

  const toggleRide = (ride: RidePublic) => {
    setFeedback(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ride.id)) next.delete(ride.id);
      else next.add(ride.id);
      return next;
    });
  };

  const toggleAll = () => {
    setFeedback(null);
    setSelected(allSelected ? new Set() : new Set(selectableRides.map((r) => r.id)));
  };

  const handleSendMatches = async () => {
    if (selected.size === 0) return;
    setSending(true);
    setError("");

    try {
      const rideIds = rides.filter((r) => selected.has(r.id)).map((r) => r.id);

      const payload = {
        ride_ids: rideIds,
        pickup_address_id: addressValue.type === "saved" ? addressValue.addressId : undefined,
        custom_address: addressValue.type === "custom" ? addressValue.custom : undefined,
        pickup_lat: resolvedCoords?.pickup_lat,
        pickup_lng: resolvedCoords?.pickup_lng,
        pickup_label: resolvedCoords?.pickup_label,
        pickup_region: resolvedCoords?.pickup_region,
        dropoff_lat: resolvedCoords?.dropoff_lat,
        dropoff_lng: resolvedCoords?.dropoff_lng,
      };

      const { data } = await matchesApi.requestBatch(payload);

      const createdByRide = new Map(data.created.map((m) => [m.ride_id, m.id]));
      setRides((prev) =>
        prev.map((r) =>
          createdByRide.has(r.id)
            ? { ...r, my_match_id: createdByRide.get(r.id), my_match_status: "pending" }
            : r
        )
      );
      setSelected(new Set());
      setFeedback({ sent: data.created.length, skipped: data.skipped });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro ao enviar os matchings."));
    } finally {
      setSending(false);
    }
  };

  const rideLabel = (rideId: number) => {
    const r = rides.find((x) => x.id === rideId);
    return r
      ? `${r.driver.name ?? "Motorista"} (${r.origin_label} → ${r.destination_label})`
      : `Carona #${rideId}`;
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Pedir Carona</h2>
        <p className={styles.subtitle}>
          Encontre motoristas da UFRGS que passam no seu trajeto com menor desvio
        </p>
      </div>

      <form onSubmit={handleSearch} className={styles.form}>
        {/* Sentido da Viagem */}
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Sentido da Carona</label>
          <div className={styles.directionToggle}>
            <button
              type="button"
              className={[
                styles.directionBtn,
                direction === "to_campus" ? styles.directionBtnActive : "",
              ].join(" ")}
              onClick={() => setDirection("to_campus")}
            >
              <span className={styles.directionIcon}><Icon name="school" size={24} /></span>
              <div>
                <strong>Indo para a UFRGS</strong>
                <p>Embarque no seu endereço → Chegada no campus</p>
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
              <span className={styles.directionIcon}><Icon name="home" size={24} /></span>
              <div>
                <strong>Saindo da UFRGS</strong>
                <p>Embarque no campus → Chegada no seu endereço</p>
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
                <span className={styles.campusDot} />
                <span className={styles.campusName}>{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Endereço Pessoal (Privado) */}
        <div className={styles.section}>
          <AddressSelector
            label={
              direction === "to_campus"
                ? "Seu Ponto de Embarque (Endereço Pessoal)"
                : "Seu Ponto de Desembarque (Endereço Pessoal)"
            }
            value={addressValue}
            onChange={setAddressValue}
            required
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <Button type="submit" fullWidth loading={loading}>
          <Icon name="search" /> Buscar caronas disponíveis
        </Button>
      </form>

      {searched && !loading && (
        <div className={styles.results}>
          {rides.length === 0 ? (
            <div className={styles.empty}>
              <p>Nenhuma carona encontrada com menos de 3 km de desvio.</p>
              <p className={styles.emptyHint}>
                Tente ajustar seu endereço ou o campus de destino.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.resultsHeader}>
                <div>
                  <p className={styles.resultsLabel}>
                    {rides.length}{" "}
                    {rides.length === 1 ? "carona disponível" : "caronas disponíveis"}, ordenadas por
                    menor desvio
                  </p>
                  <p className={styles.resultsHint}>
                    Dê matching em quantas quiser. O primeiro motorista que aceitar confirma sua
                    carona e os outros pedidos simultâneos são cancelados automaticamente.
                  </p>
                </div>
                {selectableRides.length > 1 && (
                  <button
                    type="button"
                    id="toggle-select-all"
                    className={styles.selectAllBtn}
                    onClick={toggleAll}
                  >
                    {allSelected ? "Limpar seleção" : "Selecionar todas"}
                  </button>
                )}
              </div>

              {feedback && (
                <div className={styles.feedback} role="status">
                  {feedback.sent > 0 && (
                    <p className={styles.feedbackOk}>
                      <Icon name="check" size={16} /> {feedback.sent}{" "}
                      {feedback.sent === 1 ? "matching enviado" : "matchings enviados"}! Seu
                      endereço exato só será revelado ao motorista que aceitar.
                    </p>
                  )}
                  {feedback.skipped.map((s) => (
                    <p key={s.ride_id} className={styles.feedbackSkip}>
                      <Icon name="alert" size={16} /> {rideLabel(s.ride_id)}: {s.reason}
                    </p>
                  ))}
                </div>
              )}

              {alreadyRequested > 0 && !feedback && (
                <p className={styles.resultsHint}>
                  Você já enviou matching para {alreadyRequested}{" "}
                  {alreadyRequested === 1 ? "carona desta lista" : "caronas desta lista"}.
                </p>
              )}

              {rides.map((ride, idx) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  rank={idx + 1}
                  selectable
                  selected={selected.has(ride.id)}
                  onToggleSelect={sending ? undefined : toggleRide}
                />
              ))}
            </>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className={styles.actionBar}>
          <div className={styles.actionBarInner}>
            <div className={styles.actionCount}>
              <span className={styles.actionCountNum}>{selected.size}</span>
              <span className={styles.actionCountLabel}>
                {selected.size === 1 ? "carona selecionada" : "caronas selecionadas"}
              </span>
            </div>
            <Button id="send-matchings" onClick={handleSendMatches} loading={sending}>
              <Icon name="send" size={16} /> Enviar matching ({selected.size})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
