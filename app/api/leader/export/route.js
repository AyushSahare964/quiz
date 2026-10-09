import { NextResponse } from 'next/server';
import { board, getPeople, getRoom, leaderOf } from '@/lib/store';

const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

// Results as CSV (opens in Excel; File > Import in Google Sheets).
export async function GET(req) {
  if (!leaderOf(req)) return NextResponse.json({ message: 'Leader login required.' }, { status: 401 });
  const code = new URL(req.url).searchParams.get('code');
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ message: 'Quiz not found.' }, { status: 404 });

  const people = await getPeople(code);
  const rank = Object.fromEntries(board(people).map(r => [r.pid, r.rank]));
  const rows = [
    ['Rank', 'Name', 'Email', 'Phone', 'College', 'Department', 'Approval', 'Score', 'Total', 'Percent', 'Seconds', 'Status'],
    ...people
      .sort((a, b) => (rank[a.pid] ?? 1e9) - (rank[b.pid] ?? 1e9))
      .map(p => [rank[p.pid] ?? '', p.name, p.email, p.phone, p.college, p.department, p.approval,
        p.result?.score ?? '', p.result?.total ?? '', p.result?.percentage ?? '', p.result?.elapsedSec ?? '', p.result?.status ?? (p.session ? 'PLAYING' : '')]),
  ];
  return new NextResponse('﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="quiz-${code}-results.csv"`,
    },
  });
}
