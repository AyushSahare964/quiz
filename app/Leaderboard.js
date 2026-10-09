const mmss = t => {
  const m = Math.floor(t / 60);
  return String(m).padStart(2, '0') + ':' + (t - m * 60).toFixed(0).padStart(2, '0');
};
const clock = at => (at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');

// final = quiz concluded: show the winner banner.
export default function Leaderboard({ rows = [], me, final = false }) {
  if (!rows.length) return <p className="lb-empty">No approved participants yet.</p>;
  const w = final && rows[0]?.rank === 1 ? rows[0] : null;
  return (
    <>
      {w && (
        <div className="winner-banner">
          <span className="winner-trophy">🏆</span>
          <div>
            <small>WINNER</small>
            <strong>{w.avatar} {w.name}</strong>
            <span>{w.college} · {w.score}/{w.total} · {mmss(w.elapsedSec ?? 0)} · finished {clock(w.at)}</span>
          </div>
        </div>
      )}
      <div className="lb-list">
        {rows.map(r => (
          <div key={r.pid} className={`lb-row ${r.pid === me ? 'me' : ''} ${r.rank && r.rank <= 3 ? 'top' : ''} ${r.rank === 1 ? 'rank-gold' : r.rank === 2 ? 'rank-silver' : r.rank === 3 ? 'rank-bronze' : ''}`}>
            <span className="lb-rank">{r.rank ? (['🥇', '🥈', '🥉'][r.rank - 1] || `#${r.rank}`) : '–'}</span>
            <span className="lb-avatar">{r.avatar}</span>
            <span className="lb-who">
              <strong>{r.name}</strong>
              <small>{r.college} · {r.department}</small>
            </span>
            {r.state === 'ready' ? (
              <span className="lb-state ready">Ready</span>
            ) : (
              <span className="lb-score">
                {r.status === 'DISQUALIFIED' ? 'DQ' : `${r.score ?? 0}/${r.total ?? '–'}`}
                <small>
                  {r.state === 'playing'
                    ? `● Live · ${r.answered ?? 0} answered · ${clock(r.at)}`
                    : `${mmss(r.elapsedSec ?? 0)} · ${clock(r.at)}`}
                </small>
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
