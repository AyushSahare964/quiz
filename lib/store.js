import crypto from 'crypto';
import { verifyToken } from './quiz.js';

// ponytail: in-memory rooms, so one server process only (next dev / next start).
// Move to Redis/DB if this is deployed to serverless.
export const rooms = (globalThis.__quizRooms ??= new Map());

// Predefined leader logins from env: LEADERS="id:password,id:password,id:password" (see .env.example).
export const LEADERS = (process.env.LEADERS || '')
  .split(',')
  .map(x => x.trim().split(':'))
  .filter(([id, password]) => id && password)
  .map(([id, password]) => ({ id, password }));

export const AVATARS = ['🧑‍⚕️', '🫀', '🧠', '🔬', '🧬', '🩺', '💉', '🦾', '🧪', '🩻', '🫁', '🦴'];

const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode() {
  let c;
  do c = Array.from({ length: 6 }, () => CH[crypto.randomInt(CH.length)]).join('');
  while (rooms.has(c));
  return c;
}

export function leaderOf(req) {
  const t = verifyToken(req.cookies.get('leader')?.value);
  return t?.exp > Date.now() ? t.leader : null;
}

// Participant token -> { room, p }.
export function who(token) {
  const t = verifyToken(token);
  const room = rooms.get(t?.code);
  return { t, room, p: room?.people.get(t?.pid) };
}

// Public leaderboard: finished (ranked) > playing > ready > disqualified.
export function board(room) {
  const tier = p => (p.result ? (p.result.status === 'DISQUALIFIED' ? 3 : 0) : p.session ? 1 : 2);
  let rank = 0;
  return [...room.people.values()]
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
