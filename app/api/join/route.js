import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { appendRow, signToken } from '@/lib/quiz';
import { AVATARS, getPeople, getRoom, putPerson } from '@/lib/store';

export async function POST(req) {
  try {
    const b = await req.json();
    const f = k => String(b[k] || '').trim().replace(/\s+/g, ' ').slice(0, 100);
    const fail = (m, s = 400) => NextResponse.json({ message: m }, { status: s });

    const code = f('code').toUpperCase();
    const room = await getRoom(code);
    if (!room) return fail('Invalid quiz code. Check the code your organizer shared.', 404);
    if (room.status === 'ended') return fail('This quiz has already ended.');

    const name = f('name'), email = f('email').toLowerCase(), phone = f('phone').replace(/[\s-]/g, '');
    const college = f('college'), department = f('department');
    if (name.length < 2) return fail('Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Please enter a valid email address.');
    if (!/^\+?\d{7,15}$/.test(phone)) return fail('Please enter a valid phone number.');
    if (!college) return fail('Please enter your college name.');
    if (!department) return fail('Please enter your department name.');
    const avatar = AVATARS.includes(b.avatar) ? b.avatar : AVATARS[0];

    // Same email + phone re-joining (e.g. cleared browser) gets the same profile back.
    const dup = (await getPeople(code)).find(p => p.email === email);
    if (dup) {
      if (dup.phone !== phone) return fail('This email is already registered for this quiz.', 409);
      return NextResponse.json({ token: signToken({ code, pid: dup.pid }) });
    }

    const p = {
      pid: crypto.randomUUID(), name, email, phone, college, department, avatar,
      approval: 'pending', joinedAt: Date.now(), session: null, result: null,
    };
    await putPerson(code, p);
    await appendRow('Participants!A:I', [
      new Date(p.joinedAt).toISOString(), code, p.pid, name, email, phone, college, department, avatar,
    ]);
    return NextResponse.json({ token: signToken({ code, pid: p.pid }) });
  } catch (err) {
    console.error('API Join error:', err);
    return NextResponse.json({ message: 'Server error joining quiz.' }, { status: 500 });
  }
}
