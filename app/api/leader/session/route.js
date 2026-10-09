import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { LEADERS, leaderOf } from '@/lib/store';
import { signToken } from '@/lib/quiz';

const h = s => crypto.createHash('sha256').update(String(s ?? '')).digest();
const TTL = 12 * 3600 * 1000;

export const GET = req => NextResponse.json({ leader: leaderOf(req) });

export async function POST(req) {
  const { id, password } = await req.json().catch(() => ({}));
  const ok = LEADERS.find(l => l.id === String(id || '').trim().toLowerCase() && crypto.timingSafeEqual(h(l.password), h(String(password ?? '').trim())));
  if (!ok) return NextResponse.json({ message: 'Invalid leader ID or password.' }, { status: 401 });
  const res = NextResponse.json({ leader: ok.id });
  res.cookies.set('leader', signToken({ leader: ok.id, exp: Date.now() + TTL }), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: TTL / 1000, secure: req.nextUrl.protocol === 'https:',
  });
  return res;
}

export function DELETE() {
  const res = NextResponse.json({ leader: null });
  res.cookies.delete('leader');
  return res;
}
