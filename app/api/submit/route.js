import { NextResponse } from 'next/server';
import { DURATION_SEC, appendRow, score } from '@/lib/quiz';
import { board, who } from '@/lib/store';

export async function POST(req) {
  try {
    const { token, answers, tabSwitches } = await req.json();
    const { t: s, room, p } = who(token);
    if (!p || !s.ids || !answers) return NextResponse.json({ message: 'Invalid submission session.' }, { status: 400 });

    if (p.result) {
      return NextResponse.json({
        ok: false,
        code: 'DUPLICATE',
        message: 'A submission for this participant already exists. Only one attempt is counted.',
      });
    }

    const elapsedMs = Math.max(0, Date.now() - s.startMs);
    const elapsedSec = Math.round(elapsedMs / 10) / 100;
    const tabs = Math.max(0, Math.floor(Number(tabSwitches || 0)));
    const { score: sc, total, log, percentage, review } = score(s.ids, answers);

    const status = tabs >= 5 ? 'DISQUALIFIED' : elapsedSec > DURATION_SEC + 10 ? 'LATE' : 'VALID';
    p.result = { score: sc, total, percentage, elapsedSec, status }; // set before the await: blocks double submit

    await appendRow('Responses!A:N', [
      new Date().toISOString(),
      p.name,
      `${p.email} | ${p.phone}`,
      sc,
      percentage,
      elapsedSec,
      status,
      p.pid,
      tabs,
      elapsedMs,
      JSON.stringify(log),
      room.code,
      p.college,
      p.department,
    ]);

    return NextResponse.json({
      ok: true,
      elapsedSec,
      status,
      tabSwitches: tabs,
      score: sc,
      total,
      percentage,
      review,
      name: p.name,
      board: board(room),
    });
  } catch (err) {
    console.error('API Submit error:', err);
    return NextResponse.json({ message: err.message || 'Server error submitting quiz.' }, { status: 500 });
  }
}
