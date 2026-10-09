import { NextResponse } from 'next/server';
import { PRESETS, DURATION_SEC, logEvent } from '@/lib/quiz';
import { board, leaderOf, newCode, rooms } from '@/lib/store';

const view = room => ({
  code: room.code,
  title: room.title,
  preset: PRESETS[room.preset].name,
  status: room.status,
  durationSeconds: DURATION_SEC,
  people: [...room.people.values()].map(({ session, result, ...p }) => ({
    ...p, state: result ? 'finished' : session ? 'playing' : 'idle',
  })),
  board: board(room),
});

export async function GET(req) {
  if (!leaderOf(req)) return NextResponse.json({ message: 'Leader login required.' }, { status: 401 });
  const code = new URL(req.url).searchParams.get('code');
  if (code) {
    const room = rooms.get(code);
    return room ? NextResponse.json(view(room)) : NextResponse.json({ message: 'Quiz not found.' }, { status: 404 });
  }
  return NextResponse.json({
    presets: Object.entries(PRESETS).map(([id, p]) => ({ id, name: p.name })),
    rooms: [...rooms.values()].reverse().map(r => ({
      code: r.code, title: r.title, status: r.status, leader: r.leader, count: r.people.size,
    })),
  });
}

export async function POST(req) {
  const leader = leaderOf(req);
  if (!leader) return NextResponse.json({ message: 'Leader login required.' }, { status: 401 });
  const { action, code, pid, title, preset } = await req.json().catch(() => ({}));
  const fail = (m, s = 400) => NextResponse.json({ message: m }, { status: s });

  if (action === 'create') {
    if (!PRESETS[preset]) return fail('Pick a question set.');
    const room = {
      code: newCode(), title: String(title || '').trim().slice(0, 80) || 'Biomedical Quiz', preset,
      leader, status: 'lobby', createdAt: Date.now(), people: new Map(),
    };
    rooms.set(room.code, room);
    logEvent(room.code, 'quiz_created', `${room.title} | ${room.preset}`, leader);
    return NextResponse.json(view(room));
  }

  const room = rooms.get(code);
  if (!room) return fail('Quiz not found.', 404);

  if (action === 'start' || action === 'end') {
    room.status = action === 'start' ? 'live' : 'ended';
    logEvent(code, action === 'start' ? 'quiz_started' : 'quiz_ended', '', leader);
  }
  else if (action === 'approve' || action === 'reject') {
    const to = action === 'approve' ? 'approved' : 'rejected';
    for (const p of room.people.values()) {
      if (pid === 'all' ? p.approval !== 'pending' : p.pid !== pid) continue;
      p.approval = to;
      logEvent(code, to, `${p.name} | ${p.email}`, leader);
    }
  } else return fail('Unknown action.');

  return NextResponse.json(view(room));
}
