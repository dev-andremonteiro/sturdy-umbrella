"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

const DECK = ["?", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "☕"];
const SESSION_KEY = "ponto-player";

type Player = { name: string; admin: boolean; voted: boolean; vote: string | null };
type PreviousRound = {
  round: number;
  topic: string | null;
  average: number | null;
  votes: { name: string; value: string | null }[];
};
type RoomState = {
  active: boolean;
  topic?: string;
  revealed?: boolean;
  round?: number;
  isMember?: boolean;
  isAdmin?: boolean;
  ownVote?: string | null;
  average?: number | null;
  previous?: PreviousRound | null;
  players?: Player[];
  playerId?: string;
  error?: string;
};

export default function Home() {
  const playerId = useRef("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [topic, setTopic] = useState("");
  const [nextTopic, setNextTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/room?playerId=${encodeURIComponent(playerId.current)}`, { cache: "no-store" });
      const data: RoomState = await response.json();
      if (response.ok) setRoom(data);
      else setMessage(data.error || "Não foi possível carregar a sala.");
    } catch {
      setMessage("Não foi possível conectar à sala.");
    }
  }, []);

  useEffect(() => {
    playerId.current = localStorage.getItem(SESSION_KEY) ?? "";
    refresh();
    const interval = window.setInterval(() => !document.hidden && refresh(), 3000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, playerId: playerId.current, ...extra }),
      });
      const data: RoomState = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Algo deu errado.");
        if (response.status === 409) await refresh();
        return;
      }
      if (data.playerId) {
        playerId.current = data.playerId;
        localStorage.setItem(SESSION_KEY, data.playerId);
      }
      if (!data.active) {
        playerId.current = "";
        localStorage.removeItem(SESSION_KEY);
      }
      setRoom(data);
    } catch {
      setMessage("Não foi possível conectar à sala.");
    } finally {
      setBusy(false);
    }
  }

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    act("create", { name, password, topic });
  }

  function submitJoin(event: FormEvent) {
    event.preventDefault();
    act("join", { name, password });
  }

  if (!room) {
    return <main className="loading-page"><div className="spinner" /><p>Carregando…</p></main>;
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Ponto, início"><span className="brand-mark">P</span><span>Ponto</span></a>
        <div className="status"><i /> sala única</div>
      </header>

      {message && <div className="notice" role="alert">{message}<button aria-label="Fechar aviso" onClick={() => setMessage("")}>×</button></div>}

      {!room.active ? (
        <section className="landing">
          <div className="hero-copy">
            <span className="eyebrow">UMA SALA POR VEZ</span>
            <h1>Planning poker</h1>
            <p>Crie a sala e compartilhe a senha.</p>
          </div>
          <form className="entry-card" onSubmit={submitCreate}>
            <div className="card-heading"><span>Nova sala</span><small>você será o admin</small></div>
            <label>Seu nome<input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Ex: André" required /></label>
            <label>Senha da sala<input value={password} onChange={(e) => setPassword(e.target.value)} maxLength={32} placeholder="Algo fácil de compartilhar" required /></label>
            <label>Primeiro item <em>opcional</em><input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={90} placeholder="Ex: Tela de checkout" /></label>
            <button className="primary" disabled={busy}>{busy ? "Criando…" : "Criar sala"}<span>→</span></button>
            <p className="fine-print">A sala expira em 6 horas.</p>
          </form>
        </section>
      ) : !room.isMember ? (
        <section className="join-wrap">
          <div className="join-intro">
            <span className="eyebrow">SALA ATIVA</span>
            <h1>Entrar na sala</h1>
            <p>Informe seu nome e a senha.</p>
          </div>
          <form className="entry-card compact" onSubmit={submitJoin}>
            <div className="card-heading"><span>Entrar na sala</span><small>{room.players?.length ?? 0} na mesa</small></div>
            <label>Seu nome<input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Como devemos te chamar?" required /></label>
            <label>Senha<input value={password} onChange={(e) => setPassword(e.target.value)} maxLength={32} placeholder="Senha compartilhada pelo admin" required /></label>
            <button className="primary" disabled={busy}>{busy ? "Entrando…" : "Entrar"}<span>→</span></button>
          </form>
        </section>
      ) : (
        <section className="room-layout">
          <div className="table-area">
            <div className="round-meta"><span>RODADA {room.round}</span>{room.revealed && <b>VOTOS REVELADOS</b>}</div>
            <h1>{room.topic}</h1>

            {room.revealed ? (
              <div className="result-panel">
                <div><small>MÉDIA</small><strong>{room.average ?? "—"}</strong></div>
                <p>Os jogadores podem alterar os votos até a próxima rodada.</p>
              </div>
            ) : (
              <div className="vote-intro"><h2>Escolha um voto</h2><p>Os votos ficam ocultos até o admin revelar.</p></div>
            )}

            <div className="deck" aria-label="Cartas de estimativa">
              {DECK.map((value) => (
                <button key={value} className={room.ownVote === value ? "selected" : ""} onClick={() => act("vote", { value })} disabled={busy} aria-pressed={room.ownVote === value}>{value}</button>
              ))}
            </div>

            {room.isAdmin && (
              <div className="admin-bar">
                {!room.revealed ? (
                  <button className="primary reveal" onClick={() => act("reveal")} disabled={busy}>Revelar votos</button>
                ) : (
                  <div className="next-round">
                    <input value={nextTopic} onChange={(e) => setNextTopic(e.target.value)} maxLength={90} placeholder="Título da nova rodada" aria-label="Título da nova rodada" />
                    <button className="primary" onClick={() => { act("next", { topic: nextTopic }); setNextTopic(""); }} disabled={busy}>Nova rodada</button>
                  </div>
                )}
                <button className="danger-link" onClick={() => confirm("Encerrar a sala para todos?") && act("close")} disabled={busy}>Encerrar sala</button>
              </div>
            )}

            {room.isAdmin && room.previous && (
              <section className="previous-round">
                <div className="previous-heading">
                  <div><small>RODADA {room.previous.round}</small><h2>{room.previous.topic}</h2></div>
                  <span>Média <b>{room.previous.average ?? "—"}</b></span>
                </div>
                <div className="previous-votes">
                  {room.previous.votes.map((vote, index) => (
                    <div key={`${vote.name}-${index}`}><span>{vote.name}</span><b>{vote.value ?? "—"}</b></div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="players-panel">
            <div className="panel-title"><span>Na mesa</span><b>{room.players?.length ?? 0}</b></div>
            <div className="player-list">
              {room.players?.map((player, index) => (
                <div className="player-row" key={`${player.name}-${index}`}>
                  <span className="avatar">{player.name.charAt(0).toUpperCase()}</span>
                  <div><strong>{player.name}</strong>{player.admin && <small>admin</small>}</div>
                  <span className={`vote-status ${player.voted ? "done" : ""}`}>{room.revealed ? player.vote ?? "—" : player.voted ? "✓" : "…"}</span>
                </div>
              ))}
            </div>
            <p className="sync-note"><i /> Atualização automática</p>
          </aside>
        </section>
      )}
    </main>
  );
}
