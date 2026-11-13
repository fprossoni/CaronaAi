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
import "./MessagesPage.css";

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
    <section className="chat-panel" aria-label={title(conversation, userId)}>
      <header className="chat-header">
        <Link to="/messages" className="chat-back">← Conversas</Link>
        <h2>{title(conversation, userId)}</h2>
        <p>{conversation.origin_label} → {conversation.destination_label}</p>
        <p>{new Date(conversation.departure_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
        <details className="chat-members">
          <summary>{conversation.participants.length} participantes{conversation.kind === "group" ? " · Conversas privadas" : ""}</summary>
          <ul>{conversation.participants.map((p) => (
            <li key={p.id}>
              <span>{p.name ?? "Participante"}{p.id === conversation.driver_id ? " · Motorista" : ""}{p.id === userId ? " · Você" : ""}</span>
              {privateParticipants.some((person) => person.id === p.id) && (
                <button type="button" onClick={() => void onPrivate(p.id === conversation.driver_id ? userId : p.id)}>Conversar em privado</button>
              )}
            </li>
          ))}</ul>
        </details>
      </header>
      <div className="chat-stream" ref={scroll} role="log" aria-label="Mensagens da conversa" aria-live="polite"
        onScroll={() => { if (scroll.current) follow.current = scroll.current.scrollHeight - scroll.current.scrollTop - scroll.current.clientHeight < 80; }}>
        {hasOlder && <Button variant="ghost" size="sm" loading={olderLoading} onClick={loadOlder}>Carregar anteriores</Button>}
        {loading && <p className="chat-notice">Carregando mensagens…</p>}
        {!loading && items.length === 0 && !closed && <div className="chat-empty"><MessageIcon size={32} /><p>Combine os detalhes da viagem por aqui.</p><small>As conversas ficam ativas até o motorista concluir a carona.</small></div>}
        {items.map((message) => (
          <article key={message.id} className={`chat-bubble ${message.sender_id === userId ? "chat-mine" : ""}`}>
            <strong>{message.sender_id === userId ? "Você" : message.sender.name ?? "Participante"}</strong>
            <p>{message.body}</p>
            <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
          </article>
        ))}
      </div>
      {error && <p role="alert" className="chat-error">{error}</p>}
      <form onSubmit={send} className="chat-compose">
        <label className="sr-only" htmlFor="message-body">Sua mensagem</label>
        <textarea id="message-body" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000}
          rows={2} placeholder="Escreva uma mensagem…" disabled={closed || sending} />
        <Button type="submit" loading={sending} disabled={loading || closed || !draft.trim()}>Enviar</Button>
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
          if (!cancelled) { setConversations(data); setError(""); }
        } catch (err) {
          if (!cancelled) setError(getErrorMessage(err, "Não foi possível carregar as conversas."));
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      if (!cancelled) timer = setTimeout(refresh, 5000);
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
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

  return <div className="messages-page">
    <div className="chat-page-heading"><div><h1>Mensagens</h1><p>Suas conversas nas caronas confirmadas.</p></div><Link to="/rides">Minhas caronas →</Link></div>
    {error && <p role="alert" className="chat-error">{error}</p>}
    <div className={`chat-shell ${selected ? "chat-has-selection" : ""}`}>
      <aside className="chat-sidebar" aria-label="Conversas ativas">
        <h2>Conversas ativas <span>{conversations.length}</span></h2>
        {loading && <p className="chat-notice">Carregando conversas…</p>}
        {!loading && conversations.length === 0 && <div className="chat-empty"><MessageIcon size={32} /><p>Nenhuma conversa ativa</p><small>Em Minhas caronas, toque em Mensagens após a confirmação de um passageiro.</small><Link to="/rides">Ver minhas caronas</Link></div>}
        {conversations.map((c) => <Link key={c.id} to={`/messages?conversation=${c.id}`} className={`chat-conversation ${selectedId === c.id ? "selected" : ""}`} aria-current={selectedId === c.id ? "page" : undefined}>
          {c.kind === "group" ? <span className="chat-group-icon"><UsersIcon size={22} /></span> : <Avatar name={title(c, userId)} size="sm" />}
          <div><strong>{title(c, userId)}</strong><p>{c.destination_label}</p><small>{c.kind === "group" ? "Grupo" : "Privada"} · {new Date(c.departure_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></div>
        </Link>)}
      </aside>
      {selected ? <ConversationPanel key={selected.id} conversation={selected} userId={userId} onPrivate={openPrivate} />
        : <div className="chat-placeholder"><MessageIcon size={42} /><h2>{selectedId && !loading ? "Conversa indisponível" : "Tudo combinado para a viagem"}</h2><p>{selectedId && !loading ? "A carona pode ter sido encerrada ou sua participação cancelada." : "Selecione um grupo ou uma conversa privada para começar."}</p></div>}
    </div>
  </div>;
}
