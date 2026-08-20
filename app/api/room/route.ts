import { NextRequest, NextResponse } from "next/server";
import {
  DECK,
  addPlayer,
  closeRoom,
  createRoom,
  readRoom,
  saveVote,
  updateRoom,
  type Room,
} from "@/lib/room-store";

export const dynamic = "force-dynamic";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function snapshot(room: Room | null, playerId = "") {
  if (!room) return { active: false };

  const currentVotes = room.votes.filter((vote) => vote.round === room.round);
  const ownVote = currentVotes.find((vote) => vote.playerId === playerId)?.value ?? null;
  const numericVotes = currentVotes.map((vote) => Number(vote.value)).filter(Number.isFinite);
  const previousVotes = room.previousRound
    ? room.votes.filter((vote) => vote.round === room.previousRound)
    : [];
  const previousNumericVotes = previousVotes.map((vote) => Number(vote.value)).filter(Number.isFinite);

  return {
    active: true,
    topic: room.topic,
    revealed: room.revealed,
    round: room.round,
    isMember: room.players.some((player) => player.id === playerId),
    isAdmin: room.adminId === playerId,
    ownVote,
    average:
      room.revealed && numericVotes.length
        ? Math.round((numericVotes.reduce((sum, vote) => sum + vote, 0) / numericVotes.length) * 10) / 10
        : null,
    previous:
      room.adminId === playerId && room.previousRound
        ? {
            round: room.previousRound,
            topic: room.previousTopic,
            average: previousNumericVotes.length
              ? Math.round(
                  (previousNumericVotes.reduce((sum, vote) => sum + vote, 0) /
                    previousNumericVotes.length) *
                    10,
                ) / 10
              : null,
            votes: room.players.map((player) => ({
              name: player.name,
              value: previousVotes.find((vote) => vote.playerId === player.id)?.value ?? null,
            })),
          }
        : null,
    players: room.players.map((player) => {
      const vote = currentVotes.find((item) => item.playerId === player.id);
      return {
        name: player.name,
        admin: player.id === room.adminId,
        voted: Boolean(vote),
        vote: room.revealed ? vote?.value ?? null : null,
      };
    }),
  };
}

export async function GET(request: NextRequest) {
  try {
    const playerId = request.nextUrl.searchParams.get("playerId") ?? "";
    return NextResponse.json(snapshot(await readRoom(), playerId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return error("A sala está indisponível. Confira a integração do Redis na Vercel.", 503);
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return error("Pedido inválido.");
  }

  try {
    const action = clean(body.action, 20);
    const playerId = clean(body.playerId, 80);
    let room = await readRoom();

    if (action === "create") {
      if (room) return error("Já existe uma sala ativa. Entre com a senha.", 409);
      const name = clean(body.name, 24);
      const password = clean(body.password, 32);
      const topic = clean(body.topic, 90) || "Primeira estimativa";
      if (!name || !password) return error("Informe seu nome e uma senha para a sala.");

      const id = crypto.randomUUID();
      const created = await createRoom(
        { adminId: id, password, topic, revealed: false, round: 1, createdAt: Date.now() },
        { id, name, joinedAt: Date.now() },
      );
      if (!created) return error("Alguém acabou de criar a sala. Entre com a senha.", 409);
      room = await readRoom();
      return NextResponse.json({ ...snapshot(room, id), playerId: id });
    }

    if (!room) return error("Não existe uma sala ativa.", 404);

    if (action === "join") {
      const name = clean(body.name, 24);
      const password = clean(body.password, 32);
      if (!name || !password) return error("Informe seu nome e a senha da sala.");
      if (password !== room.password) return error("Senha incorreta.", 403);

      const id = crypto.randomUUID();
      await addPlayer({ id, name, joinedAt: Date.now() });
      return NextResponse.json({ ...snapshot(await readRoom(), id), playerId: id });
    }

    const player = room.players.find((item) => item.id === playerId);
    if (!player) return error("Entre na sala novamente.", 403);

    if (action === "vote") {
      const value = clean(body.value, 4);
      if (!DECK.includes(value)) return error("Carta inválida.");
      await saveVote({ playerId, value, round: room.round });
    } else {
      if (room.adminId !== playerId) return error("Apenas o admin pode fazer isso.", 403);

      if (action === "reveal") {
        await updateRoom({ revealed: true });
      } else if (action === "next") {
        await updateRoom({
          topic: clean(body.topic, 90) || room.topic,
          previousTopic: room.topic,
          previousRound: room.round,
          revealed: false,
          round: room.round + 1,
        });
      } else if (action === "close") {
        await closeRoom();
        return NextResponse.json({ active: false });
      } else {
        return error("Ação inválida.");
      }
    }

    return NextResponse.json(snapshot(await readRoom(), playerId));
  } catch {
    return error("Não foi possível atualizar a sala. Tente novamente.", 500);
  }
}
