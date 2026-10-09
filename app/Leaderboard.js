const mmss = t => {
  const m = Math.floor(t / 60);
  return String(m).padStart(2, '0') + ':' + (t - m * 60).toFixed(0).padStart(2, '0');
};

export default function Leaderboard({ rows = [], me }) {
  if (!rows.length) return <p className="lb-empty">No approved participants yet.</p>;
  return (
    <div className="lb-list">
      {rows.map(r => (
        <div key={r.pid} className={`lb-row ${r.pid === me ? 'me' : ''} ${r.rank && r.rank <= 3 ? 'top' : ''}`}>
          <span className="lb-rank">{r.rank ? (['🥇', '🥈', '🥉'][r.rank - 1] || r.rank) : '–'}</span>
          <span className="lb-avatar">{r.avatar}</span>
          <span className="lb-who">
            <strong>{r.name}</strong>
            <small>{r.college} · {r.department}</small>
          </span>
          {r.state === 'finished' ? (
            <span className="lb-score">
              {r.status === 'DISQUALIFIED' ? 'DQ' : `${r.score}/${r.total}`}
              <small>{mmss(r.elapsedSec)}</small>
            </span>
          ) : (
            <span className={`lb-state ${r.state}`}>{r.state === 'playing' ? '● Playing' : 'Ready'}</span>
          )}
        </div>
      ))}
    </div>
  );
}
