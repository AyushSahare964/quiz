import { NextResponse } from 'next/server';
import { score } from '@/lib/quiz';
import { putLive, who } from '@/lib/store';

// Called as a participant answers: keeps their live score on the leaderboard.
export async function POST(req) {
  const { token, answers } = await req.json().catch(() => ({}));
  const { t: s, room, p } = await who(token);
  if (!p || !s?.ids || !answers || p.result || room.status === 'ended') return NextResponse.json({ ok: false });
  const r = score(s.ids, answers);
  await putLive(room.code, p.pid, { score: r.score, total: r.total, answered: Object.keys(answers).length, at: Date.now() });
  return NextResponse.json({ ok: true });
}
