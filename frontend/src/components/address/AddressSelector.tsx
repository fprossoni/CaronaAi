import React, { useEffect, useState } from "react";
import { addressesApi } from "@/api/addresses";
import type { AddressPublic, AddressCreate } from "@/types/address";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import styles from "./AddressSelector.module.css";

export interface SelectedAddressValue {
  type: "saved" | "custom";
  addressId?: number;
  custom?: AddressCreate;
  saveAddress?: boolean;
}

interface AddressSelectorProps {
  label?: string;
  value: SelectedAddressValue;
  onChange: (val: SelectedAddressValue) => void;
  required?: boolean;
}

export const AddressSelector: React.FC<AddressSelectorProps> = ({
  label = "Endereço Pessoal (Origem/Destino)",
  value,
  onChange,
}) => {
  const [savedAddresses, setSavedAddresses] = useState<AddressPublic[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  const [customForm, setCustomForm] = useState<AddressCreate>({
    label: "Minha Casa",
    postal_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "Porto Alegre",
    state: "RS",
    country: "Brasil",
  });

  const [saveToFavorites, setSaveToFavorites] = useState(true);

  // Carrega os endereços pessoais salvos
  useEffect(() => {
    let active = true;
    setLoadingSaved(true);
    addressesApi
      .list()
      .then((res) => {
        if (!active) return;
        setSavedAddresses(res.data);
        // Se houver endereços salvos e nada estiver selecionado, seleciona o primeiro por padrão
        if (res.data.length > 0 && value.type === "saved" && !value.addressId) {
          onChange({
            type: "saved",
            addressId: res.data[0].id,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingSaved(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleModeChange = (mode: "saved" | "custom") => {
    if (mode === "saved") {
      onChange({
        type: "saved",
        addressId: savedAddresses.length > 0 ? savedAddresses[0].id : undefined,
      });
    } else {
      onChange({
        type: "custom",
        custom: customForm,
        saveAddress: saveToFavorites,
      });
    }
  };

  const handleSavedSelect = (addressId: number) => {
    onChange({
      type: "saved",
      addressId,
    });
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value: val } = e.target;
    const updated = { ...customForm, [name]: val };
    setCustomForm(updated);
    onChange({
      type: "custom",
      custom: updated,
      saveAddress: saveToFavorites,
    });
  };

  const handleCepBlur = async () => {
    const rawCep = customForm.postal_code.replace(/\D/g, "");
    if (rawCep.length !== 8) return;

    setCepLoading(true);
    setCepError("");
    try {
      const res = await addressesApi.lookupCep(rawCep);
      const data = res.data;
      const updated: AddressCreate = {
        ...customForm,
        postal_code: data.postal_code || rawCep,
        street: data.street || customForm.street,
        neighborhood: data.neighborhood || customForm.neighborhood,
        city: data.city || customForm.city,
        state: data.state || customForm.state,
      };
      setCustomForm(updated);
      onChange({
        type: "custom",
        custom: updated,
        saveAddress: saveToFavorites,
      });
    } catch {
      setCepError("CEP não encontrado. Preencha os campos manualmente.");
    } finally {
      setCepLoading(false);
    }
  };

  const handleSaveToFavoritesToggle = (checked: boolean) => {
    setSaveToFavorites(checked);
    onChange({
      type: "custom",
      custom: customForm,
      saveAddress: checked,
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.privacyBadge}><Icon name="lock" size={12} /> Privado até o matching</span>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={[styles.tab, value.type === "saved" ? styles.tabActive : ""].join(" ")}
          onClick={() => handleModeChange("saved")}
          disabled={loadingSaved || savedAddresses.length === 0}
        >
          Meus Endereços Salvos ({savedAddresses.length})
        </button>
        <button
          type="button"
          className={[styles.tab, value.type === "custom" ? styles.tabActive : ""].join(" ")}
          onClick={() => handleModeChange("custom")}
        >
          Novo Endereço
        </button>
      </div>

      {value.type === "saved" && (
        <div className={styles.savedSection}>
          {loadingSaved ? (
            <p className={styles.muted}>Carregando seus endereços...</p>
          ) : savedAddresses.length === 0 ? (
            <div className={styles.emptySaved}>
              <p>Você ainda não tem nenhum endereço salvo.</p>
              <Button size="sm" variant="secondary" onClick={() => handleModeChange("custom")}>
                Cadastrar um endereço
              </Button>
            </div>
          ) : (
            <div className={styles.savedGrid}>
              {savedAddresses.map((addr) => {
                const isSelected = value.addressId === addr.id;
                return (
                  <button
                    key={addr.id}
                    type="button"
                    className={[styles.savedCard, isSelected ? styles.savedCardSelected : ""].join(
                      " "
                    )}
                    onClick={() => handleSavedSelect(addr.id)}
                  >
                    <div className={styles.savedCardHeader}>
                      <span className={styles.savedCardLabel}><Icon name="pin" size={14} /> {addr.label}</span>
                      {isSelected && <span className={styles.checkIcon}><Icon name="check" size={16} strokeWidth={2.5} /></span>}
                    </div>
                    <p className={styles.savedCardAddress}>
                      {addr.street}, {addr.number}
                      {addr.complement ? ` - ${addr.complement}` : ""}
                    </p>
                    <p className={styles.savedCardSub}>
                      {addr.neighborhood} · {addr.city}/{addr.state} (CEP: {addr.postal_code})
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {value.type === "custom" && (
        <div className={styles.customSection}>
          <div className={styles.rowTwo}>
            <div className={styles.cepField}>
              <Input
                label="CEP"
                name="postal_code"
                placeholder="Ex: 90040-060"
                value={customForm.postal_code}
                onChange={handleCustomChange}
                onBlur={handleCepBlur}
                required
              />
              {cepLoading && <span className={styles.cepNotice}>Buscando endereço...</span>}
              {cepError && <span className={styles.cepErrorText}>{cepError}</span>}
            </div>

            <Input
              label="Apelido (ex: Casa, Trabalho)"
              name="label"
              placeholder="Ex: Minha Casa"
              value={customForm.label}
              onChange={handleCustomChange}
              required
            />
          </div>

          <div className={styles.rowStreet}>
            <Input
              label="Rua / Avenida"
              name="street"
              placeholder="Ex: Av. Ipiranga"
              value={customForm.street}
              onChange={handleCustomChange}
              required
            />
            <div className={styles.numField}>
              <Input
                label="Número"
                name="number"
                placeholder="Ex: 2752"
                value={customForm.number}
                onChange={handleCustomChange}
                required
              />
            </div>
          </div>

          <div className={styles.rowTwo}>
            <Input
              label="Complemento (opcional)"
              name="complement"
              placeholder="Ex: Apto 302, Bloco B"
              value={customForm.complement ?? ""}
              onChange={handleCustomChange}
            />
            <Input
              label="Bairro"
              name="neighborhood"
              placeholder="Ex: Santana"
              value={customForm.neighborhood ?? ""}
              onChange={handleCustomChange}
              required
            />
          </div>

          <div className={styles.rowThree}>
            <Input
              label="Cidade"
              name="city"
              value={customForm.city}
              onChange={handleCustomChange}
              required
            />
            <div className={styles.ufField}>
              <Input
                label="Estado (UF)"
                name="state"
                value={customForm.state}
                onChange={handleCustomChange}
                maxLength={2}
                required
              />
            </div>
            <Input
              label="País"
              name="country"
              value={customForm.country}
              onChange={handleCustomChange}
              required
            />
          </div>

          <label className={styles.saveCheckbox}>
            <input
              type="checkbox"
              checked={saveToFavorites}
              onChange={(e) => handleSaveToFavoritesToggle(e.target.checked)}
            />
            <span>Salvar este endereço na minha lista pessoal para próximas caronas</span>
          </label>
        </div>
      )}
    </div>
  );
};
