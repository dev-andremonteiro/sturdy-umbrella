import { Redis } from "@upstash/redis";

const ROOM_KEY = "ponto:room";
const LOCK_KEY = "ponto:room:active";
const TTL_SECONDS = 6 * 60 * 60;

export const DECK = ["?", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "☕"];

export type Player = { id: string; name: string; joinedAt: number };
export type Vote = { playerId: string; value: string; round: number };
export type Room = {
  adminId: string;
  password: string;
  topic: string;
  revealed: boolean;
  round: number;
  createdAt: number;
  players: Player[];
  votes: Vote[];
};

let redis: Redis | undefined;

function db() {
  redis ??= Redis.fromEnv();
  return redis;
}

function asObject<T>(value: unknown): T {
  return typeof value === "string" ? JSON.parse(value) : (value as T);
}

export async function readRoom(): Promise<Room | null> {
  const values = await db().hgetall<Record<string, unknown>>(ROOM_KEY);
  if (!values?.adminId) return null;

  const players: Player[] = [];
  const votes: Vote[] = [];

  for (const [key, value] of Object.entries(values)) {
    if (key.startsWith("player:")) players.push(asObject<Player>(value));
    if (key.startsWith("vote:")) votes.push(asObject<Vote>(value));
  }

  return {
    adminId: String(values.adminId),
    password: String(values.password ?? ""),
    topic: String(values.topic ?? "Primeira estimativa"),
    revealed: values.revealed === true || values.revealed === "true" || values.revealed === 1,
    round: Number(values.round ?? 1),
    createdAt: Number(values.createdAt ?? Date.now()),
    players: players.sort((a, b) => a.joinedAt - b.joinedAt),
    votes,
  };
}

export async function createRoom(room: Omit<Room, "players" | "votes">, admin: Player) {
  const claimed = await db().set(LOCK_KEY, "1", { nx: true, ex: TTL_SECONDS });
  if (!claimed) return false;

  try {
    await db().hset(ROOM_KEY, {
      adminId: room.adminId,
      password: room.password,
      topic: room.topic,
      revealed: room.revealed,
      round: room.round,
      createdAt: room.createdAt,
      [`player:${admin.id}`]: JSON.stringify(admin),
    });
    await db().expire(ROOM_KEY, TTL_SECONDS);
    return true;
  } catch (error) {
    await db().del(LOCK_KEY);
    throw error;
  }
}

export async function addPlayer(player: Player) {
  await db().hset(ROOM_KEY, { [`player:${player.id}`]: JSON.stringify(player) });
}

export async function saveVote(vote: Vote) {
  await db().hset(ROOM_KEY, { [`vote:${vote.playerId}`]: JSON.stringify(vote) });
}

export async function updateRoom(fields: Record<string, string | number | boolean>) {
  await db().hset(ROOM_KEY, fields);
}

export async function closeRoom() {
  await db().del(ROOM_KEY, LOCK_KEY);
}
