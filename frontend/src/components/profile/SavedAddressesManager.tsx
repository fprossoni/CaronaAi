/**
 * SavedAddressesManager Component
 *
 * Allows students to save personal recurring addresses (e.g. "Casa", "Trabalho", "República")
 * with automatic Brazilian postal code lookup (ViaCEP via `/addresses/cep/{cep}`)
 * and backend Nominatim geocoding (`POST /addresses/`).
 */

import React, { useEffect, useState } from "react";
import { addressesApi } from "@/api/addresses";
import type { AddressPublic } from "@/types/address";
import { MOCK_HOME_ADDRESS } from "@/data/devMocks";
import { useToastStore } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { SavedAddressForm } from "@/components/profile/SavedAddressForm";
import { MapPinIcon, NavigationIcon, XIcon } from "@/components/ui/Icons";

export const SavedAddressesManager: React.FC<{ playground?: boolean }> = ({ playground = false }) => {
  const toast = useToastStore();
  const isMockMode = import.meta.env.DEV && playground;

  const [addresses, setAddresses] = useState<AddressPublic[]>(() =>
    isMockMode ? [MOCK_HOME_ADDRESS] : []
  );
  const [loading, setLoading] = useState(() => !isMockMode);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (isMockMode) return;
    let active = true;
    addressesApi
      .list()
      .then((res) => {
        if (active) setAddresses(res.data);
      })
      .catch(() => {
        // Silent fallback if backend is unreachable
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isMockMode]);

  const handleDelete = async (addr: AddressPublic) => {
    const ok = await toast.confirm({
      title: `Remover "${addr.label}"?`,
      description: `${addr.street}, ${addr.number} deixará de aparecer nos seus atalhos rápidos.`,
      confirmLabel: "Remover endereço",
      variant: "danger",
    });
    if (!ok) return;

    try {
      if (!isMockMode) {
        await addressesApi.delete(addr.id);
      }
      setAddresses((prev) => prev.filter((item) => item.id !== addr.id));
      toast.info("Endereço removido.");
    } catch (err: unknown) {
      toast.error("Não foi possível remover", getErrorMessage(err));
    }
  };

  return (
    <div
      className="rounded-3xl border p-6 space-y-4"
      style={{
        background: "var(--gradient-card)",
        borderColor: "var(--color-border)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 shrink-0 mt-0.5">
            <MapPinIcon size={20} />
          </div>
          <div>
            <h3 className="text-base font-extrabold" style={{ color: "var(--color-text)" }}>
              Meus Endereços Salvos
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Cadastre Casa, Trabalho ou República por CEP para pedir e oferecer caronas com 1 clique.
            </p>
          </div>
        </div>

        {!showAddForm && (
          <Button size="sm" variant="secondary" onClick={() => setShowAddForm(true)}>
            + Novo Endereço
          </Button>
        )}
      </div>

      {showAddForm && (
        <div className="p-4 rounded-2xl border border-[var(--color-border)]">
          <SavedAddressForm
            playground={playground}
            onCancel={() => setShowAddForm(false)}
            onSaved={(address) => {
              setAddresses((prev) => [...prev, address]);
              setShowAddForm(false);
            }}
          />
        </div>
      )}

      {/* Saved List */}
      {loading ? (
        <p className="text-xs py-4 text-center animate-pulse" style={{ color: "var(--color-text-muted)" }}>
          Carregando endereços salvos...
        </p>
      ) : addresses.length === 0 ? (
        <div
          className="p-4 rounded-2xl border border-dashed text-center"
          style={{ borderColor: "var(--color-border)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Você ainda não possui endereços salvos. Adicione sua casa ou trabalho para agilizar suas próximas caronas!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="p-3.5 rounded-2xl border flex items-start justify-between gap-3 transition hover:border-indigo-500/40"
              style={{
                backgroundColor: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <NavigationIcon size={13} className="text-emerald-400 shrink-0" />
                  <span className="text-sm font-bold truncate" style={{ color: "var(--color-text)" }}>
                    {addr.label}
                  </span>
                </div>
                <p className="text-xs truncate" style={{ color: "var(--color-text-secondary)" }}>
                  {addr.street}, {addr.number}
                  {addr.complement ? ` (${addr.complement})` : ""}
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>
                  {addr.neighborhood ? `${addr.neighborhood} • ` : ""}
                  {addr.city}/{addr.state} • CEP {addr.postal_code}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDelete(addr)}
                className="p-1.5 rounded-xl text-red-400 hover:bg-red-500/15 transition shrink-0"
                title="Remover endereço"
                aria-label={`Remover ${addr.label}`}
              >
                <XIcon size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
