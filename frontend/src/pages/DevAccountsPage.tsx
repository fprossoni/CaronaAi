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
  const returnTo =
    requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/find";

  useEffect(() => {
    const controller = new AbortController();
    devAccountsApi
      .list(controller.signal)
      .then(({ data }) => {
        if (!controller.signal.aborted) setAccounts(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setListError(getErrorMessage(err, "Erro ao carregar contas de teste."));
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
      setActionError(getErrorMessage(err, "Não foi possível abrir sessão de teste."));
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
    <section className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text">
          Contas de teste
        </h1>
        {user && (
          <Link to={returnTo} className="font-mono text-xs font-semibold text-accent-text hover:underline no-underline">
            Continuar como {user.name ?? user.email} →
          </Link>
        )}
      </header>

      {listError ? (
        <div className="space-y-3 rounded-[10px] border border-border bg-surface p-4">
          <p role="alert" className="text-sm text-danger">
            {listError}
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setListError("");
              setRetry((count) => count + 1);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      ) : accounts === null ? (
        <p role="status" className="font-mono text-xs text-text-muted">
          Carregando…
        </p>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <form
            onSubmit={createAccount}
            className="space-y-4 rounded-[10px] border border-border bg-surface p-5"
          >
            <h2 className="font-display text-base font-bold text-text">Criar conta</h2>
            <Input
              label="Nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />
            <div className="space-y-1.5">
              <label
                htmlFor={genderId}
                className="block text-xs font-semibold uppercase tracking-wider text-text-muted"
              >
                Sexo
              </label>
              <select
                id={genderId}
                value={gender}
                onChange={(event) => setGender(event.target.value as Gender | "")}
                required
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
              >
                <option value="" disabled>
                  Selecione
                </option>
                {Object.entries(genderLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              fullWidth
              disabled={pending !== null || !name.trim() || !gender}
              loading={pending === "create"}
            >
              Criar e entrar
            </Button>
          </form>

          <section className="space-y-3 rounded-[10px] border border-border bg-surface p-5">
            <h2 className="font-display text-base font-bold text-text">Trocar de conta</h2>
            {accounts.length === 0 ? (
              <p className="text-xs text-text-muted">Nenhuma conta neste navegador.</p>
            ) : (
              <ul className="divide-y divide-border">
                {accounts.map((account) => (
                  <li key={account.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={account.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-text">{account.name}</p>
                      <p className="font-mono text-[11px] text-text-muted">
                        {account.gender ? genderLabels[account.gender] : "—"} ·{" "}
                        {account.is_driver ? "Motorista" : "Passageiro"}
                      </p>
                    </div>
                    {user?.id === account.id ? (
                      <span className="font-mono text-[10px] uppercase text-accent-text">
                        Atual
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending !== null}
                        loading={pending === account.id}
                        onClick={() =>
                          void openSession(() => devAccountsApi.signIn(account.id), account.id)
                        }
                        aria-label={`Entrar como ${account.name}`}
                      >
                        Entrar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {actionError && (
        <p role="alert" className="text-xs text-danger">
          {actionError}
        </p>
      )}
    </section>
  );
}
