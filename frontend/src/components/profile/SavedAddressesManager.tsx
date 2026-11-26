import React, { useEffect, useState } from "react";
import { addressesApi } from "@/api/addresses";
import type { AddressPublic } from "@/types/address";
import { useToastStore } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { SavedAddressForm } from "@/components/profile/SavedAddressForm";
import { MapPinIcon, NavigationIcon, XIcon } from "@/components/ui/Icons";

export const SavedAddressesManager: React.FC = () => {
  const toast = useToastStore();

  const [addresses, setAddresses] = useState<AddressPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    let active = true;
    addressesApi
      .list()
      .then((res) => {
        if (active) setAddresses(res.data);
      })
      .catch(() => {
        // Silent fallback
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDelete = async (addr: AddressPublic) => {
    const ok = await toast.confirm({
      title: `Remover "${addr.label}"?`,
      description: `${addr.street}, ${addr.number}`,
      confirmLabel: "Remover",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await addressesApi.delete(addr.id);
      setAddresses((prev) => prev.filter((item) => item.id !== addr.id));
      toast.info("Endereço removido.");
    } catch (err: unknown) {
      toast.error("Erro ao remover", getErrorMessage(err));
    }
  };

  return (
    <div className="rounded-[10px] border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md border border-border bg-surface-2 text-accent-text shrink-0">
            <MapPinIcon size={17} />
          </div>
          <h3 className="font-display text-base font-bold text-text">Endereços salvos</h3>
        </div>

        {!showAddForm && (
          <Button size="sm" variant="secondary" onClick={() => setShowAddForm(true)}>
            + Novo
          </Button>
        )}
      </div>

      {showAddForm && (
        <div className="p-4 rounded-md border border-border bg-surface-2">
          <SavedAddressForm
            onCancel={() => setShowAddForm(false)}
            onSaved={(address) => {
              setAddresses((prev) => [...prev, address]);
              setShowAddForm(false);
            }}
          />
        </div>
      )}

      {loading ? (
        <p className="font-mono text-xs py-4 text-center text-text-muted animate-pulse">
          Carregando…
        </p>
      ) : addresses.length === 0 ? (
        <div className="p-4 rounded-md border border-dashed border-border text-center">
          <p className="text-xs text-text-muted">Nenhum endereço salvo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="p-3 rounded-md border border-border bg-surface-2 flex items-start justify-between gap-3 transition-colors hover:border-border-strong"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <NavigationIcon size={12} className="text-accent-text shrink-0" />
                  <span className="text-sm font-bold truncate text-text">{addr.label}</span>
                </div>
                <p className="text-xs truncate text-text-secondary">
                  {addr.street}, {addr.number}
                  {addr.complement ? ` (${addr.complement})` : ""}
                </p>
                <p className="font-mono text-[10px] truncate text-text-muted">
                  {addr.neighborhood ? `${addr.neighborhood} · ` : ""}
                  {addr.city}/{addr.state} · {addr.postal_code}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDelete(addr)}
                className="p-1.5 rounded-md text-danger hover:bg-danger/10 transition-colors shrink-0"
                title="Remover endereço"
                aria-label={`Remover ${addr.label}`}
              >
                <XIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
