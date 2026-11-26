import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { messagesApi } from "@/api/messages";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

import { getErrorMessage } from "@/lib/errors";
import { useToastStore } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import type { ChatMessage, Conversation } from "@/types/chat";

const title = (c: Conversation, userId: number) =>
  c.kind === "group"
    ? "Grupo da carona"
    : c.participants.find((p) => p.id !== userId)?.name ?? "Conversa privada";

function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]) {
  return [...new Map([...previous, ...incoming].map((m) => [m.id, m])).values()].sort(
    (a, b) => a.id - b.id
  );
}

function ConversationPanel({
  conversation,
  userId,
  onPrivate,
}: {
  conversation: Conversation;
  userId: number;
  onPrivate: (passengerId: number) => Promise<void>;
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
        const { data } = await messagesApi.items(
          conversation.id,
          cursor.current === undefined ? undefined : { after: cursor.current }
        );
        if (cancelled) return;
        if (cursor.current === undefined) setHasOlder(data.length === 50);
        cursor.current = data.at(-1)?.id ?? cursor.current ?? 0;
        setItems((prev) => mergeMessages(prev, data));
        setError("");
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err, "Erro ao atualizar mensagens."));
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
    return () => {
      cancelled = true;
      mounted.current = false;
      clearTimeout(timer);
    };
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
      if (mounted.current) setError(getErrorMessage(err, "Mensagem não enviada."));
    } finally {
      if (mounted.current) setSending(false);
    }
  };

  const privateParticipants =
    conversation.kind === "group"
      ? conversation.participants.filter((p) =>
          userId === conversation.driver_id ? p.id !== userId : p.id === conversation.driver_id
        )
      : [];

  return (
    <section className="flex min-h-0 min-w-0 flex-col" aria-label={title(conversation, userId)}>
      <header className="max-h-[45%] overflow-auto border-b border-border px-4 py-3 md:px-5 md:py-4">
        <Link
          to="/messages"
          className="mb-2 inline-block font-mono text-xs font-semibold text-accent-text hover:underline md:hidden"
        >
          ← Conversas
        </Link>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-display font-bold text-text">{title(conversation, userId)}</h2>
          <time className="font-mono text-[11px] text-text-muted">
            {new Date(conversation.departure_at).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </time>
        </div>
        <p className="text-xs text-text-muted mt-0.5">
          {conversation.origin_label} → {conversation.destination_label}
        </p>
        <details className="mt-2 text-xs text-text-secondary">
          <summary className="cursor-pointer select-none font-mono text-[11px]">
            {conversation.participants.length} participantes
            {conversation.kind === "group" ? " · Privado" : ""}
          </summary>
          <ul className="space-y-1.5 pt-2">
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
                    className="text-right text-xs font-semibold text-accent-text hover:underline"
                    onClick={() => void onPrivate(p.id === conversation.driver_id ? userId : p.id)}
                  >
                    Privado
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-bg p-3.5 md:p-5"
        ref={scroll}
        role="log"
        aria-label="Mensagens da conversa"
        aria-live="polite"
        onScroll={() => {
          if (scroll.current) {
            follow.current =
              scroll.current.scrollHeight - scroll.current.scrollTop - scroll.current.clientHeight <
              80;
          }
        }}
      >
        {hasOlder && (
          <Button variant="ghost" size="sm" loading={olderLoading} onClick={loadOlder}>
            Carregar anteriores
          </Button>
        )}
        {loading && (
          <p className="p-5 text-center font-mono text-xs text-text-muted">Carregando…</p>
        )}

        {items.map((message) => {
          const isMine = message.sender_id === userId;
          return (
            <article
              key={message.id}
              className={`max-w-[85%] px-3.5 py-2.5 rounded-md wrap-anywhere ${
                isMine
                  ? "self-end bg-primary text-on-primary"
                  : "self-start border border-border bg-surface-2 text-text"
              }`}
            >
              <strong
                className={`font-mono text-[10px] uppercase tracking-wider block mb-0.5 ${
                  isMine ? "text-on-primary/75" : "text-accent-text"
                }`}
              >
                {isMine ? "Você" : message.sender.name ?? "Participante"}
              </strong>
              <p className="whitespace-pre-wrap text-sm">{message.body}</p>
              <time
                dateTime={message.created_at}
                className={`mt-1 block text-right font-mono text-[10px] ${
                  isMine ? "text-on-primary/70" : "text-text-muted"
                }`}
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
        <p role="alert" className="px-4 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <form
        onSubmit={send}
        className="flex items-end gap-2 border-t border-border p-3 md:gap-2.5 md:p-3.5"
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
          placeholder="Mensagem…"
          disabled={closed || sending}
          className="max-h-35 min-w-0 flex-1 resize-y rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
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
  return <MessagesInbox key={userId} userId={userId} />;
}

function MessagesInbox({ userId }: { userId: number }) {
  const toast = useToastStore();
  const [deleting, setDeleting] = useState(false);
  const deletedIds = useRef(new Set<number>());
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
            setConversations(data.filter((c) => !deletedIds.current.has(c.id)));
            setError("");
          }
        } catch (err) {
          if (!cancelled) setError(getErrorMessage(err, "Não foi possível carregar conversas."));
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

  const deleteSelected = async () => {
    if (!selected || deleting) return;
    if (!(await toast.confirm({ title: "Excluir conversa?", description: "A conversa será removida da sua lista. Os outros participantes manterão o histórico.", confirmLabel: "Excluir conversa", variant: "danger" }))) return;
    setDeleting(true);
    try {
      await messagesApi.remove(selected.id);
      deletedIds.current.add(selected.id);
      setConversations((prev) => prev.filter((c) => c.id !== selected.id));
      setParams({});
      toast.info("Conversa excluída.");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível excluir a conversa."));
    } finally {
      setDeleting(false);
    }
  };

  const openPrivate = async (passengerId: number) => {
    if (!selected) return;
    try {
      const { data } = await messagesApi.open(selected.ride_id, passengerId);
      deletedIds.current.delete(data.id);
      setConversations((prev) => [data, ...prev.filter((c) => c.id !== data.id)]);
      setParams({ conversation: String(data.id) });
    } catch (err) {
      setError(getErrorMessage(err, "Erro ao abrir conversa privada."));
    }
  };

  return (
    <div className="text-text animate-fade-in">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">Mensagens</h1>
        {selected && <Button type="button" variant="danger" size="sm" loading={deleting} onClick={deleteSelected}>Excluir conversa</Button>}
        <Link to="/rides" className="font-mono text-xs font-semibold text-accent-text hover:underline no-underline">
          Minhas caronas →
        </Link>
      </div>

      {error && (
        <p role="alert" className="px-4 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="grid h-[calc(100dvh-230px)] min-h-95 grid-cols-1 overflow-hidden rounded-[10px] border border-border bg-surface md:h-[min(740px,calc(100dvh-210px))] md:min-h-110 md:grid-cols-[290px_minmax(0,1fr)]">
        <aside
          className={`overflow-y-auto p-3 md:border-r md:border-border ${
            selected ? "hidden md:block" : "block"
          }`}
          aria-label="Conversas ativas"
        >
          <h2 className="flex justify-between px-2 pt-1 pb-4 font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <span>Ativas</span>
            <span>{conversations.length}</span>
          </h2>

          {loading && (
            <p className="p-5 text-center font-mono text-xs text-text-muted">Carregando…</p>
          )}

          {!loading && conversations.length === 0 && (
            <div className="m-auto flex flex-col items-center justify-center gap-2.5 px-4 py-8 text-center text-text-muted">

              <p className="text-sm text-text-secondary">Nenhuma conversa ativa.</p>
              <Link to="/rides" className="text-xs font-semibold text-accent-text hover:underline">
                Minhas caronas
              </Link>
            </div>
          )}

          {conversations.map((c) => {
            const isSelected = selectedId === c.id;
            return (
              <Link
                key={c.id}
                to={`/messages?conversation=${c.id}`}
                className={`mb-1 flex items-center gap-3 rounded-md px-2.5 py-3 text-inherit no-underline transition-colors hover:bg-surface-hover ${
                  isSelected ? "bg-surface-2 shadow-[inset_3px_0_var(--color-primary)]" : ""
                }`}
                aria-current={isSelected ? "page" : undefined}
              >
                {c.kind === "group" ? null : (
                  <Avatar name={title(c, userId)} size="sm" />
                )}
                <div className="min-w-0">
                  <strong className="text-[13px] block truncate">{title(c, userId)}</strong>
                  <p className="truncate text-xs text-text-secondary">{c.destination_label}</p>
                  <small className="font-mono text-[10px] text-text-muted">
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
          <div className="hidden flex-col items-center justify-center gap-2.5 px-5 py-8 text-center text-text-muted bg-dot-matrix md:flex">

            <h2 className="font-display font-semibold text-text">
              {selectedId && !loading ? "Conversa indisponível" : "Selecione uma conversa"}
            </h2>
          </div>
        )}
      </div>
    </div>
  );
}
