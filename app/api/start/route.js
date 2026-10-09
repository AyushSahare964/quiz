import { NextResponse } from 'next/server';
import { DURATION_SEC, eventQuestions, shuffle, signToken } from '@/lib/quiz';
import { putPerson, who } from '@/lib/store';

export async function POST(req) {
  try {
    const { token } = await req.json();
    const { room, p } = await who(token);
    const fail = (m, s = 400) => NextResponse.json({ message: m }, { status: s });

    if (!p) return fail('Session expired. Please join again.', 401);
    if (p.approval !== 'approved') return fail('Waiting for the organizer to approve you.', 403);
    if (room.status !== 'live') return fail('The organizer has not started the quiz yet.', 403);
    if (p.result) return fail('You have already completed this quiz.', 409);
    if (p.session) return NextResponse.json(p.session); // resume

    // Every participant gets the room's questions in their own random order, with shuffled options.
    const questions = shuffle(
      eventQuestions(room.preset).map(q => ({
        id: q.id,
        difficulty: q.d,
        question: q.q,
        options: shuffle(q.o.slice()),
        correctAnswer: q.o[q.a],
        explanation: q.exp || '',
      }))
    );
    const startMs = Date.now();
    p.session = {
      token: signToken({ code: room.code, pid: p.pid, startMs, ids: questions.map(q => q.id) }),
      serverStartMs: startMs,
      durationSeconds: DURATION_SEC,
      questions,
    };
    await putPerson(room.code, p);
    return NextResponse.json(p.session);
  } catch (err) {
    console.error('API Start error:', err);
    return NextResponse.json({ message: err.message || 'Server error starting quiz.' }, { status: 500 });
  }
}
