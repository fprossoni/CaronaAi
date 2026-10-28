import React, { useEffect, useState } from "react";
import { addressesApi } from "@/api/addresses";
import type { AddressPublic, AddressCreate } from "@/types/address";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { getErrorMessage } from "@/lib/errors";
import styles from "./SavedAddressesManager.module.css";

export const SavedAddressesManager: React.FC = () => {
  const [addresses, setAddresses] = useState<AddressPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepNotice, setCepNotice] = useState("");

  const [form, setForm] = useState<AddressCreate>({
    label: "",
    postal_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "Porto Alegre",
    state: "RS",
    country: "Brasil",
  });

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const res = await addressesApi.list();
      setAddresses(res.data);
    } catch (err) {
      setError(getErrorMessage(err, "Erro ao carregar endereços salvos."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCepBlur = async () => {
    const cleanCep = form.postal_code.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setCepLoading(true);
    setCepNotice("");
    try {
      const res = await addressesApi.lookupCep(cleanCep);
      const data = res.data;
      setForm((prev) => ({
        ...prev,
        postal_code: data.postal_code || cleanCep,
        street: data.street || prev.street,
        neighborhood: data.neighborhood || prev.neighborhood,
        city: data.city || prev.city,
        state: data.state || prev.state,
      }));
      setCepNotice("Endereço preenchido automaticamente pelo CEP.");
    } catch {
      setCepNotice("CEP não localizado. Preencha os dados manualmente.");
    } finally {
      setCepLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await addressesApi.create(form);
      setShowAddForm(false);
      setForm({
        label: "",
        postal_code: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "Porto Alegre",
        state: "RS",
        country: "Brasil",
      });
      await loadAddresses();
    } catch (err) {
      setError(getErrorMessage(err, "Erro ao salvar endereço. Verifique os dados."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este endereço?")) return;
    try {
      await addressesApi.delete(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(getErrorMessage(err, "Erro ao excluir endereço."));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Meus Endereços Pessoais</h3>
          <p className={styles.subtitle}>
            <Icon name="lock" size={13} /> Endereços guardados com segurança. Eles permanecem privados e só são revelados após a confirmação do matching.
          </p>
        </div>
        {!showAddForm && (
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Icon name="plus" size={16} /> Adicionar endereço
          </Button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {showAddForm && (
        <form onSubmit={handleAddSubmit} className={styles.addForm}>
          <div className={styles.formHeader}>
            <h4>Cadastrar Novo Endereço</h4>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setShowAddForm(false)}
              aria-label="Fechar"
            >
              <Icon name="close" />
            </button>
          </div>

          <div className={styles.gridTwo}>
            <div>
              <Input
                label="CEP"
                name="postal_code"
                placeholder="Ex: 90040-060"
                value={form.postal_code}
                onChange={handleChange}
                onBlur={handleCepBlur}
                required
              />
              {cepLoading && <span className={styles.cepNotice}>Buscando CEP...</span>}
              {cepNotice && <span className={styles.cepNotice}>{cepNotice}</span>}
            </div>

            <Input
              label="Apelido (ex: Casa, Trabalho)"
              name="label"
              placeholder="Ex: Minha Casa"
              value={form.label}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.gridStreet}>
            <Input
              label="Rua / Logradouro"
              name="street"
              placeholder="Ex: Rua dos Andradas"
              value={form.street}
              onChange={handleChange}
              required
            />
            <Input
              label="Número"
              name="number"
              placeholder="Ex: 1234"
              value={form.number}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.gridTwo}>
            <Input
              label="Complemento"
              name="complement"
              placeholder="Ex: Apto 101"
              value={form.complement ?? ""}
              onChange={handleChange}
            />
            <Input
              label="Bairro"
              name="neighborhood"
              placeholder="Ex: Centro Histórico"
              value={form.neighborhood ?? ""}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.gridThree}>
            <Input
              label="Cidade"
              name="city"
              value={form.city}
              onChange={handleChange}
              required
            />
            <Input
              label="Estado (UF)"
              name="state"
              maxLength={2}
              value={form.state}
              onChange={handleChange}
              required
            />
            <Input
              label="País"
              name="country"
              value={form.country}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddForm(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              Salvar Endereço
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className={styles.muted}>Carregando endereços...</p>
      ) : addresses.length === 0 ? (
        <p className={styles.muted}>Você ainda não possui endereços cadastrados.</p>
      ) : (
        <div className={styles.list}>
          {addresses.map((addr) => (
            <div key={addr.id} className={styles.card}>
              <div className={styles.cardMain}>
                <div className={styles.cardTitleRow}>
                  <span className={styles.cardLabel}><Icon name="pin" size={15} /> {addr.label}</span>
                </div>
                <p className={styles.cardStreet}>
                  {addr.street}, {addr.number}
                  {addr.complement ? ` - ${addr.complement}` : ""}
                </p>
                <p className={styles.cardMeta}>
                  {addr.neighborhood} · {addr.city}/{addr.state} (CEP: {addr.postal_code})
                </p>
              </div>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => handleDelete(addr.id)}
                title="Excluir endereço"
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
