import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { messagesApi } from "@/api/messages";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { MessageIcon, UsersIcon } from "@/components/ui/Icons";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/authStore";
import type { ChatMessage, Conversation } from "@/types/chat";

const title = (c: Conversation, userId: number) => c.kind === "group"
  ? "Grupo da carona"
  : c.participants.find((p) => p.id !== userId)?.name ?? "Conversa privada";

function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]) {
  return [...new Map([...previous, ...incoming].map((m) => [m.id, m])).values()].sort((a, b) => a.id - b.id);
}

function ConversationPanel({ conversation, userId, onPrivate }: {
  conversation: Conversation; userId: number; onPrivate: (passengerId: number) => Promise<void>;
}) {
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const cursor = useRef<number | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(poll, 5000);
        return;
      }
      try {
        const { data } = await messagesApi.items(conversation.id,
          cursor.current === undefined ? undefined : { after: cursor.current });
        if (cancelled) return;
        if (cursor.current === undefined) setHasOlder(data.length === 50);
        cursor.current = data.at(-1)?.id ?? cursor.current ?? 0;
        setItems((prev) => mergeMessages(prev, data));
        setError("");
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err, "Não foi possível atualizar as mensagens. Tentando novamente…"));
        if (axios.isAxiosError(err) && [403, 404, 409].includes(err.response?.status ?? 0)) {
          setClosed(true);
          setItems([]);
          return;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (!cancelled) timer = setTimeout(poll, 5000);
    };
    void poll();
    return () => { cancelled = true; mounted.current = false; clearTimeout(timer); };
  }, [conversation.id]);

  useEffect(() => {
    if (follow.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [items]);

  const loadOlder = async () => {
    if (!items[0]) return;
    setOlderLoading(true);
    follow.current = false;
    try {
      const { data } = await messagesApi.items(conversation.id, { before: items[0].id });
      if (!mounted.current) return;
      setItems((prev) => mergeMessages(prev, data));
      setHasOlder(data.length === 50);
    } catch (err) {
      if (mounted.current) setError(getErrorMessage(err));
    } finally {
      if (mounted.current) setOlderLoading(false);
    }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || sending || closed) return;
    setSending(true);
    setError("");
    try {
      const { data } = await messagesApi.send(conversation.id, draft.trim());
      if (!mounted.current) return;
      follow.current = true;
      setItems((prev) => mergeMessages(prev, [data]));
      setDraft("");
    } catch (err) {
      if (mounted.current) setError(getErrorMessage(err, "Mensagem não enviada. Tente novamente."));
    } finally {
      if (mounted.current) setSending(false);
    }
  };

  const privateParticipants = conversation.kind === "group"
    ? conversation.participants.filter((p) => userId === conversation.driver_id ? p.id !== userId : p.id === conversation.driver_id)
    : [];

  return (
    <section className="flex min-h-0 min-w-0 flex-col" aria-label={title(conversation, userId)}>
      <header className="max-h-[45%] overflow-auto border-b border-border px-4 py-3 md:px-5.5 md:py-4.5">
        <Link
          to="/messages"
          className="mb-2 inline-block text-xs font-semibold text-primary-light hover:underline md:hidden"
        >
          ← Conversas
        </Link>
        <h2 className="font-bold text-text">{title(conversation, userId)}</h2>
        <p className="text-[13px] text-text-muted">{conversation.origin_label} → {conversation.destination_label}</p>
        <p className="text-[13px] text-text-muted">
          {new Date(conversation.departure_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </p>
        <details className="mt-2 text-xs text-text-secondary">
          <summary className="cursor-pointer select-none">
            {conversation.participants.length} participantes{conversation.kind === "group" ? " · Conversas privadas" : ""}
          </summary>
          <ul className="space-y-2 pt-2">
            {conversation.participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span>
                  {p.name ?? "Participante"}
                  {p.id === conversation.driver_id ? " · Motorista" : ""}
                  {p.id === userId ? " · Você" : ""}
                </span>
                {privateParticipants.some((person) => person.id === p.id) && (
                  <button
                    type="button"
                    className="text-right text-xs font-semibold text-primary-light hover:underline"
                    onClick={() => void onPrivate(p.id === conversation.driver_id ? userId : p.id)}
                  >
                    Conversar em privado
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-bg p-3.5 md:p-5"
        ref={scroll}
        role="log"
        aria-label="Mensagens da conversa"
        aria-live="polite"
        onScroll={() => {
          if (scroll.current) {
            follow.current = scroll.current.scrollHeight - scroll.current.scrollTop - scroll.current.clientHeight < 80;
          }
        }}
      >
        {hasOlder && (
          <Button variant="ghost" size="sm" loading={olderLoading} onClick={loadOlder}>
            Carregar anteriores
          </Button>
        )}
        {loading && <p className="p-5 text-center text-xs text-text-muted">Carregando mensagens…</p>}
        {!loading && items.length === 0 && !closed && (
          <div className="m-auto flex flex-col items-center justify-center gap-3 px-5 py-8 text-center text-text-muted">
            <MessageIcon size={32} />
            <p className="text-sm">Combine os detalhes da viagem por aqui.</p>
            <small className="max-w-75 text-xs">
              As conversas ficam ativas até o motorista concluir a carona.
            </small>
          </div>
        )}
        {items.map((message) => {
          const isMine = message.sender_id === userId;
          return (
            <article
              key={message.id}
              className={`max-w-[85%] px-3.5 py-2.5 wrap-anywhere ${
                isMine
                  ? "self-end rounded-2xl rounded-br-sm bg-primary-dark text-white"
                  : "self-start rounded-2xl rounded-bl-sm bg-surface-2 text-text"
              }`}
            >
              <strong className={`text-[11px] ${isMine ? "text-white/80" : "text-primary-light"}`}>
                {isMine ? "Você" : message.sender.name ?? "Participante"}
              </strong>
              <p className="whitespace-pre-wrap text-sm">{message.body}</p>
              <time
                dateTime={message.created_at}
                className="mt-1 block text-right text-[10px] opacity-75"
              >
                {new Date(message.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </article>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="px-4 py-2.5 text-xs text-danger">
          {error}
        </p>
      )}

      <form
        onSubmit={send}
        className="flex items-end gap-2 border-t border-border p-3 md:gap-3 md:p-4"
      >
        <label className="sr-only" htmlFor="message-body">
          Sua mensagem
        </label>
        <textarea
          id="message-body"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Escreva uma mensagem…"
          disabled={closed || sending}
          className="max-h-35 min-w-0 flex-1 resize-y rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus-visible:outline-2 focus-visible:outline-primary"
        />
        <Button type="submit" loading={sending} disabled={loading || closed || !draft.trim()}>
          Enviar
        </Button>
      </form>
    </section>
  );
}

export function MessagesPage() {
  const userId = useAuthStore((state) => state.user?.id) ?? 0;
  // Remount on account changes so no previous account's messages remain on screen.
  return <MessagesInbox key={userId} userId={userId} />;
}

function MessagesInbox({ userId }: { userId: number }) {
  const [params, setParams] = useSearchParams();
  const selectedId = Number(params.get("conversation"));
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selected = conversations.find((c) => c.id === selectedId);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (document.visibilityState !== "hidden") {
        try {
          const { data } = await messagesApi.list();
          if (!cancelled) {
            setConversations(data);
            setError("");
          }
        } catch (err) {
          if (!cancelled) setError(getErrorMessage(err, "Não foi possível carregar as conversas."));
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      if (!cancelled) timer = setTimeout(refresh, 5000);
    };
    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const openPrivate = async (passengerId: number) => {
    if (!selected) return;
    try {
      const { data } = await messagesApi.open(selected.ride_id, passengerId);
      setConversations((prev) => [data, ...prev.filter((c) => c.id !== data.id)]);
      setParams({ conversation: String(data.id) });
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível abrir a conversa privada."));
    }
  };

  return (
    <div className="text-text animate-fade-in">
      <div className="mb-5.5 flex items-start justify-between gap-4 md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold md:text-[26px]">Mensagens</h1>
          <p className="text-[13px] text-text-muted">Suas conversas nas caronas confirmadas.</p>
        </div>
        <Link to="/rides" className="text-xs font-semibold text-primary-light hover:underline">
          Minhas caronas →
        </Link>
      </div>

      {error && (
        <p role="alert" className="px-4 py-2.5 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="grid h-[calc(100dvh-240px)] min-h-95 grid-cols-1 overflow-hidden rounded-[18px] border border-border bg-surface md:h-[min(740px,calc(100dvh-230px))] md:min-h-110 md:grid-cols-[290px_minmax(0,1fr)] md:rounded-3xl">
        <aside
          className={`overflow-y-auto p-3 md:border-r md:border-border ${
            selected ? "hidden md:block" : "block"
          }`}
          aria-label="Conversas ativas"
        >
          <h2 className="flex justify-between px-2 pt-2 pb-5 text-xs font-bold">
            <span>Conversas ativas</span>
            <span className="text-text-muted">{conversations.length}</span>
          </h2>

          {loading && <p className="p-5 text-center text-xs text-text-muted">Carregando conversas…</p>}

          {!loading && conversations.length === 0 && (
            <div className="m-auto flex flex-col items-center justify-center gap-3 px-5 py-8 text-center text-text-muted">
              <MessageIcon size={32} />
              <p className="text-sm">Nenhuma conversa ativa</p>
              <small className="max-w-75 text-xs">
                Em Minhas caronas, toque em Mensagens após a confirmação de um passageiro.
              </small>
              <Link to="/rides" className="text-xs font-semibold text-primary-light hover:underline">
                Ver minhas caronas
              </Link>
            </div>
          )}

          {conversations.map((c) => {
            const isSelected = selectedId === c.id;
            return (
              <Link
                key={c.id}
                to={`/messages?conversation=${c.id}`}
                className={`mb-1 flex items-center gap-3 rounded-[14px] px-2.5 py-3.5 text-inherit no-underline transition-colors hover:bg-surface-hover ${
                  isSelected ? "bg-surface-2 shadow-[inset_3px_0_var(--color-primary)]" : ""
                }`}
                aria-current={isSelected ? "page" : undefined}
              >
                {c.kind === "group" ? (
                  <span className="rounded-[14px] bg-surface-2 p-2.5 text-primary-light">
                    <UsersIcon size={22} />
                  </span>
                ) : (
                  <Avatar name={title(c, userId)} size="sm" />
                )}
                <div className="min-w-0">
                  <strong className="text-[13px]">{title(c, userId)}</strong>
                  <p className="truncate text-xs text-text-secondary">{c.destination_label}</p>
                  <small className="text-[11px] text-text-muted">
                    {c.kind === "group" ? "Grupo" : "Privada"} ·{" "}
                    {new Date(c.departure_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </div>
              </Link>
            );
          })}
        </aside>

        {selected ? (
          <ConversationPanel
            key={selected.id}
            conversation={selected}
            userId={userId}
            onPrivate={openPrivate}
          />
        ) : (
          <div className="hidden flex-col items-center justify-center gap-3 px-5 py-8 text-center text-text-muted md:flex">
            <MessageIcon size={42} />
            <h2 className="font-semibold text-text">
              {selectedId && !loading ? "Conversa indisponível" : "Tudo combinado para a viagem"}
            </h2>
            <p className="max-w-75 text-xs">
              {selectedId && !loading
                ? "A carona pode ter sido encerrada ou sua participação cancelada."
                : "Selecione um grupo ou uma conversa privada para começar."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
