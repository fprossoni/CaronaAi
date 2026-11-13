import { useEffect, useId, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { devAccountsApi, type DevSession } from "@/api/devAccounts";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/authStore";
import type { Gender } from "@/types/user";

const genderLabels: Record<Gender, string> = {
  female: "Feminino",
  male: "Masculino",
  other: "Outro",
  prefer_not_to_say: "Prefiro não informar",
};

type Accounts = Awaited<ReturnType<typeof devAccountsApi.list>>["data"];

export function DevAccountsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setTokens } = useAuthStore();
  const genderId = useId();
  const [accounts, setAccounts] = useState<Accounts | null>(null);
  const [listError, setListError] = useState("");
  const [actionError, setActionError] = useState("");
  const [retry, setRetry] = useState(0);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [pending, setPending] = useState<"create" | number | null>(null);
  const requestedPath = (location.state as { returnTo?: string } | null)?.returnTo;
  const returnTo = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/find";

  useEffect(() => {
    const controller = new AbortController();
    devAccountsApi.list(controller.signal).then(({ data }) => {
      if (!controller.signal.aborted) setAccounts(data);
    }).catch((err: unknown) => {
      if (!controller.signal.aborted) setListError(getErrorMessage(err, "Não foi possível carregar as contas de teste."));
    });
    return () => controller.abort();
  }, [retry]);

  async function openSession(request: () => Promise<{ data: DevSession }>, action: "create" | number) {
    if (pending !== null) return;
    setPending(action);
    setActionError("");
    try {
      const { data } = await request();
      setTokens(data.access_token, data.refresh_token, data.user);
      navigate(returnTo, { replace: true });
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, "Não foi possível abrir a sessão de teste."));
    } finally {
      setPending(null);
    }
  }

  function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !gender) return;
    void openSession(() => devAccountsApi.create(name.trim(), gender), "create");
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold text-[var(--color-text)]">Contas de teste</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Crie perfis e troque entre eles neste navegador. As ações são salvas no banco da API.
        </p>
        {user && (
          <Link to={returnTo} className="inline-block text-sm font-semibold text-[var(--color-primary-light)]">
            Continuar como {user.name ?? user.email}
          </Link>
        )}
      </header>

      {listError ? (
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] p-4">
          <p role="alert" className="text-sm text-red-400">{listError}</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => {
            setListError("");
            setRetry((count) => count + 1);
          }}>Tentar novamente</Button>
        </div>
      ) : accounts === null ? (
        <p role="status" className="text-sm text-[var(--color-text-muted)]">Carregando contas de teste…</p>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <form onSubmit={createAccount} className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="text-base font-bold text-[var(--color-text)]">Criar conta</h2>
            <Input label="Nome" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
            <div className="space-y-1.5">
              <label htmlFor={genderId} className="block text-sm font-semibold text-[var(--color-text)]">Sexo</label>
              <select id={genderId} value={gender} onChange={(event) => setGender(event.target.value as Gender | "")}
                required className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-text)]">
                <option value="" disabled>Selecione</option>
                {Object.entries(genderLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <Button type="submit" fullWidth disabled={pending !== null || !name.trim() || !gender} loading={pending === "create"}>
              Criar e entrar
            </Button>
          </form>

          <section className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="text-base font-bold text-[var(--color-text)]">Trocar de conta</h2>
            {accounts.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Nenhuma conta de teste neste navegador.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {accounts.map((account) => (
                  <li key={account.id} className="flex items-center gap-3 py-3">
                    <Avatar name={account.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-[var(--color-text)]">{account.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {account.gender ? genderLabels[account.gender] : "Sexo não informado"} · {account.is_driver ? "Motorista" : "Passageiro"}
                      </p>
                    </div>
                    {user?.id === account.id ? (
                      <span className="text-xs text-[var(--color-text-muted)]">Sessão atual</span>
                    ) : (
                      <Button type="button" size="sm" variant="secondary" disabled={pending !== null}
                        loading={pending === account.id} onClick={() => void openSession(() => devAccountsApi.signIn(account.id), account.id)}
                        aria-label={`Entrar como ${account.name}`}>Entrar</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {actionError && <p role="alert" className="text-sm text-red-400">{actionError}</p>}
    </section>
  );
}
