import { NextResponse } from 'next/server';
import { DURATION_SEC, PRESETS } from '@/lib/quiz';
import { AVATARS, board, getPeople, putPerson, who } from '@/lib/store';

async function view(room, p) {
  const rows = board(await getPeople(room.code));
  const mine = rows.find(r => r.pid === p.pid);
  const { name, email, phone, college, department, avatar, approval } = p;
  return {
    room: { code: room.code, title: room.title, preset: PRESETS[room.preset].name, status: room.status, durationSeconds: DURATION_SEC },
    me: { name, email, phone, college, department, avatar, approval, rank: mine?.rank ?? null, finished: !!p.result },
    session: p.session && !p.result && Date.now() - p.session.serverStartMs < DURATION_SEC * 1000 ? p.session : null,
    board: rows,
  };
}

// Participant polls this for approval, quiz start and the live leaderboard.
export async function GET(req) {
  const { room, p } = await who(new URL(req.url).searchParams.get('token'));
  if (!p) return NextResponse.json({ message: 'Session expired. Please join again.' }, { status: 404 });
  return NextResponse.json(await view(room, p));
}

// Profile edit: avatar only.
export async function POST(req) {
  const { token, avatar } = await req.json().catch(() => ({}));
  const { room, p } = await who(token);
  if (!p) return NextResponse.json({ message: 'Session expired. Please join again.' }, { status: 404 });
  if (AVATARS.includes(avatar)) {
    p.avatar = avatar;
    await putPerson(room.code, p);
  }
  return NextResponse.json(await view(room, p));
}
