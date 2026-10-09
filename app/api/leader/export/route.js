import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { board, getPeople, getRoom, leaderOf } from '@/lib/store';

// Every participant's result as a real .xlsx (opens in Excel; upload to Google Sheets).
export async function GET(req) {
  if (!leaderOf(req)) return NextResponse.json({ message: 'Leader login required.' }, { status: 401 });
  const code = new URL(req.url).searchParams.get('code');
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ message: 'Quiz not found.' }, { status: 404 });

  const people = await getPeople(code);
  const rank = Object.fromEntries(board(people).map(r => [r.pid, r.rank]));
  const total = people.find(p => p.result)?.result.total ?? '';
  const state = p => p.result?.status ?? (p.approval !== 'approved' ? p.approval.toUpperCase() : p.session ? 'NOT SUBMITTED' : 'NOT STARTED');

  const rows = people
    .sort((a, b) =>
      (b.result?.score ?? -1) - (a.result?.score ?? -1) || (a.result?.elapsedSec ?? 1e9) - (b.result?.elapsedSec ?? 1e9))
    .map((p, i) => ({
      '#': i + 1,
      Rank: rank[p.pid] ?? '',
      Name: p.name,
      Email: p.email,
      Phone: p.phone,
      College: p.college,
      Department: p.department,
      Approval: p.approval,
      Score: p.result?.score ?? 0,
      Total: p.result?.total ?? total,
      'Percent (%)': p.result?.percentage ?? 0,
      'Time (sec)': p.result?.elapsedSec ?? '',
      Status: state(p),
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [4, 6, 24, 28, 14, 30, 22, 10, 7, 7, 11, 11, 16].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="quiz-${code}-results.xlsx"`,
    },
  });
}
