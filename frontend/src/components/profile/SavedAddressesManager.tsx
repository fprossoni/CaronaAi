/**
 * SavedAddressesManager Component
 *
 * Allows students to save personal recurring addresses (e.g. "Casa", "Trabalho", "República")
 * with automatic Brazilian postal code lookup (ViaCEP via `/addresses/cep/{cep}`)
 * and backend Nominatim geocoding (`POST /addresses/`).
 */

import React, { useEffect, useState } from "react";
import { addressesApi } from "@/api/addresses";
import type { AddressCreate, AddressPublic } from "@/types/address";
import { DEV_MOCK_TOKEN } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MapPinIcon, NavigationIcon, XIcon } from "@/components/ui/Icons";

const INITIAL_MOCK_ADDRESSES: AddressPublic[] = [
  {
    id: 8001,
    user_id: 9001,
    label: "Casa (Bom Fim)",
    street: "Av. Osvaldo Aranha",
    number: "1020",
    complement: "Apto 402",
    neighborhood: "Bom Fim",
    postal_code: "90035-191",
    city: "Porto Alegre",
    state: "RS",
    country: "Brasil",
    lat: -30.0365,
    lng: -51.2135,
    created_at: new Date().toISOString(),
    full_address: "Av. Osvaldo Aranha, 1020 — Bom Fim, Porto Alegre",
  },
];

const EMPTY_FORM: AddressCreate = {
  label: "",
  postal_code: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "Porto Alegre",
  state: "RS",
  country: "Brasil",
};

function formatCepInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

export const SavedAddressesManager: React.FC = () => {
  const toast = useToastStore();
  const isMockMode = localStorage.getItem("access_token") === DEV_MOCK_TOKEN;

  const [addresses, setAddresses] = useState<AddressPublic[]>(() =>
    isMockMode ? INITIAL_MOCK_ADDRESSES : []
  );
  const [loading, setLoading] = useState(() => !isMockMode);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepHint, setCepHint] = useState("");
  const [form, setForm] = useState<AddressCreate>(EMPTY_FORM);

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

  const handleCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setCepLoading(true);
    setCepHint("");
    try {
      if (isMockMode) {
        // Direct public ViaCEP lookup when testing in mock mode
        const resp = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const json = (await resp.json()) as {
          erro?: boolean;
          logradouro?: string;
          bairro?: string;
          localidade?: string;
          uf?: string;
        };
        if (json.erro) throw new Error("CEP não encontrado");
        setForm((prev) => ({
          ...prev,
          street: json.logradouro || prev.street,
          neighborhood: json.bairro || prev.neighborhood,
          city: json.localidade || prev.city,
          state: json.uf || prev.state,
        }));
      } else {
        const { data } = await addressesApi.lookupCep(cleanCep);
        setForm((prev) => ({
          ...prev,
          postal_code: data.postal_code || formatCepInput(cleanCep),
          street: data.street || prev.street,
          neighborhood: data.neighborhood || prev.neighborhood,
          city: data.city || prev.city,
          state: data.state || prev.state,
        }));
      }
      setCepHint("Endereço preenchido automaticamente pelo CEP.");
    } catch {
      setCepHint("CEP não localizado automaticamente. Preencha os campos abaixo.");
    } finally {
      setCepLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.street.trim() || !form.number.trim() || !form.postal_code.trim()) {
      toast.error("Campos obrigatórios", "Preencha CEP, rua e número do endereço.");
      return;
    }

    setSubmitting(true);
    try {
      if (isMockMode) {
        const mockCreated: AddressPublic = {
          ...form,
          id: Date.now(),
          user_id: 9001,
          label: form.label.trim() || "Casa",
          lat: -30.0365,
          lng: -51.2135,
          created_at: new Date().toISOString(),
          full_address: `${form.street}, ${form.number} — ${form.neighborhood || form.city}`,
        };
        setAddresses((prev) => [...prev, mockCreated]);
        toast.success("Endereço salvo!", `${mockCreated.label} adicionado aos seus atalhos.`);
      } else {
        const { data: created } = await addressesApi.create({
          ...form,
          label: form.label.trim() || "Casa",
        });
        setAddresses((prev) => [...prev, created]);
        toast.success("Endereço salvo!", `${created.label} já pode ser usado nas caronas.`);
      }
      setForm(EMPTY_FORM);
      setCepHint("");
      setShowAddForm(false);
    } catch (err: unknown) {
      toast.error("Erro ao salvar endereço", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

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

      {/* Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-2xl border space-y-3.5 animate-fade-in"
          style={{
            backgroundColor: "var(--color-surface-2)",
            borderColor: "var(--color-primary)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Novo Endereço Pessoal (Busca automática por CEP)
            </span>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setCepHint("");
              }}
              className="p-1 rounded-lg hover:bg-white/10"
              style={{ color: "var(--color-text-muted)" }}
            >
              <XIcon size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Apelido do local"
              placeholder="Ex.: Casa, República, Estágio"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
            />
            <Input
              label={cepLoading ? "CEP (Buscando ViaCEP...)" : "CEP"}
              placeholder="90035-191"
              maxLength={9}
              value={form.postal_code}
              onChange={(e) => {
                const formatted = formatCepInput(e.target.value);
                setForm({ ...form, postal_code: formatted });
                if (formatted.replace(/\D/g, "").length === 8) {
                  void handleCepLookup(formatted);
                }
              }}
              hint={cepHint || "Digite os 8 dígitos para autocompletar"}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Rua / Avenida"
                placeholder="Ex.: Av. Osvaldo Aranha"
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
                required
              />
            </div>
            <Input
              label="Número"
              placeholder="Ex.: 1020"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Complemento (opcional)"
              placeholder="Apto, Bloco..."
              value={form.complement ?? ""}
              onChange={(e) => setForm({ ...form, complement: e.target.value })}
            />
            <Input
              label="Bairro"
              placeholder="Ex.: Bom Fim"
              value={form.neighborhood ?? ""}
              onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
            />
            <Input
              label="Cidade"
              placeholder="Porto Alegre"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowAddForm(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={submitting}>
              Salvar Endereço
            </Button>
          </div>
        </form>
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
