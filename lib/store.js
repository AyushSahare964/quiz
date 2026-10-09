import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import { verifyToken } from './quiz.js';

// Storage: Upstash Redis when configured (needed on Vercel), else in-memory for local dev.
//   room:<code>         -> room meta (JSON)
//   room:<code>:people  -> hash pid -> participant (JSON), so joins/approvals never overwrite each other
//   rooms               -> set of room codes
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function memoryRedis() {
  const m = (globalThis.__quizMem ??= new Map());
  const copy = v => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
  const hash = k => m.get(k) || m.set(k, {}).get(k);
  return {
    get: async k => copy(m.get(k)),
    set: async (k, v) => void m.set(k, copy(v)),
    del: async (...ks) => void ks.forEach(k => m.delete(k)),
    srem: async (k, v) => void m.get(k)?.delete(v),
    sadd: async (k, v) => void (m.get(k) || m.set(k, new Set()).get(k)).add(v),
    smembers: async k => [...(m.get(k) || [])],
    hget: async (k, f) => copy(hash(k)[f]),
    hset: async (k, o) => void Object.assign(hash(k), copy(o)),
    hgetall: async k => (Object.keys(hash(k)).length ? copy(hash(k)) : null),
  };
}
const redis = url && token ? new Redis({ url, token }) : memoryRedis();

export const getRoom = async code => (code ? redis.get(`room:${code}`) : null);
export const putRoom = async room => {
  await redis.set(`room:${room.code}`, room);
  await redis.sadd('rooms', room.code);
};
export const deleteRoom = async code => {
  await redis.del(`room:${code}`, `room:${code}:people`);
  await redis.srem('rooms', code);
};
export const listRooms = async () =>
  (await Promise.all((await redis.smembers('rooms')).map(getRoom))).filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
export const getPeople = async code =>
  Object.values((await redis.hgetall(`room:${code}:people`)) || {}).sort((a, b) => a.joinedAt - b.joinedAt);
export const getPerson = async (code, pid) => (code && pid ? redis.hget(`room:${code}:people`, pid) : null);
export const putPerson = async (code, p) => redis.hset(`room:${code}:people`, { [p.pid]: p });

// Predefined leader logins from env: LEADERS="id:password,id:password,id:password" (see .env.example).
export const LEADERS = (process.env.LEADERS || '')
  .split(',')
  .map(x => x.trim().split(':'))
  .filter(([id, password]) => id && password)
  .map(([id, password]) => ({ id, password }));

export const AVATARS = ['🧑‍⚕️', '🫀', '🧠', '🔬', '🧬', '🩺', '💉', '🦾', '🧪', '🩻', '🫁', '🦴'];

const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export async function newCode() {
  let c;
  do c = Array.from({ length: 6 }, () => CH[crypto.randomInt(CH.length)]).join('');
  while (await getRoom(c));
  return c;
}

export function leaderOf(req) {
  const t = verifyToken(req.cookies.get('leader')?.value);
  return t?.exp > Date.now() ? t.leader : null;
}

// Participant token -> { t, room, p }.
export async function who(tok) {
  const t = verifyToken(tok);
  const [room, p] = await Promise.all([getRoom(t?.code), getPerson(t?.code, t?.pid)]);
  return { t, room, p: room ? p : null };
}

// Public leaderboard from a people array: finished (ranked) > playing > ready > disqualified.
export function board(people) {
  const tier = p => (p.result ? (p.result.status === 'DISQUALIFIED' ? 3 : 0) : p.session ? 1 : 2);
  let rank = 0;
  return people
    .filter(p => p.approval === 'approved')
    .sort((a, b) =>
      tier(a) - tier(b) ||
      (b.result?.score ?? 0) - (a.result?.score ?? 0) ||
      (a.result?.elapsedSec ?? 0) - (b.result?.elapsedSec ?? 0))
    .map(p => ({
      pid: p.pid,
      name: p.name,
      avatar: p.avatar,
      college: p.college,
      department: p.department,
      state: ['finished', 'playing', 'ready', 'finished'][tier(p)],
      rank: tier(p) === 0 ? ++rank : null,
      score: p.result?.score ?? null,
      total: p.result?.total ?? null,
      elapsedSec: p.result?.elapsedSec ?? null,
      status: p.result?.status ?? null,
    }));
}
