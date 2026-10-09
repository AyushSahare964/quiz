'use client';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Leaderboard from '../Leaderboard';

async function api(body) {
  const r = await fetch('/api/leader/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Request failed.');
  return d;
}

export default function LeaderPage() {
  const [auth, setAuth] = useState(null); // null = loading, false = logged out
  const [list, setList] = useState({ presets: [], rooms: [] });
  const [code, setCode] = useState('');
  const [room, setRoom] = useState(null);
  const [title, setTitle] = useState('');
  const [preset, setPreset] = useState('set-1');
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/leader/room' + (code ? `?code=${code}` : ''));
      if (r.status === 401) return setAuth(false);
      const d = await r.json();
      setAuth(true);
      code ? setRoom(d) : setList(d);
    } catch {}
  }, [code]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  async function act(body) {
    setError('');
    try {
      const d = await api(body);
      if (body.action === 'create') { setCode(d.code); setRoom(d); } else setRoom(d);
    } catch (e) { setError(e.message); }
  }

  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && fullScreen) {
        setFullScreen(false);
      }
    };
    const onKey = e => {
      if (e.key === 'Escape' && fullScreen) {
        setFullScreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('keydown', onKey);
    };
  }, [fullScreen]);

  function toggleFullScreen() {
    if (!fullScreen) {
      setFullScreen(true);
      try {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      } catch {}
    } else {
      setFullScreen(false);
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
      } catch {}
    }
  }

  async function confirmDelete(c, t, leave) {
    if (!confirm(`Delete quiz "${t}" (${c}) permanently? All its participants and scores will be removed.`)) return;
    setError('');
    try {
      await api({ action: 'delete', code: c });
      if (leave) { setCode(''); setRoom(null); }
      refresh();
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    setQr('');
    if (code) QRCode.toDataURL(`${location.origin}/?code=${code}`, { width: 280, margin: 1 }).then(setQr);
  }, [code]);

  const pending = room?.people.filter(p => p.approval === 'pending') || [];

  return (
    <main className="site-main">
      <div className="shell">
        {auth === null && <section className="card">Loading…</section>}
        {auth === false && (
          <section className="card">
            <h1 className="hero-title">Leader access only</h1>
            <p className="hero-subtitle">Use <strong>Leader Login</strong> in the top-right corner of the header.</p>
          </section>
        )}

        {auth && !code && (
          <section className="card">
            <h1 className="hero-title" style={{ fontSize: 28 }}>Create a quiz</h1>
            <div className="grid-inputs" style={{ marginTop: 18 }}>
              <div className="field-group">
                <label className="field-label" htmlFor="t">Quiz title</label>
                <input id="t" className="text-input" placeholder="e.g. Round 1 – Biosignals" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="p">Preset question set</label>
                <select id="p" className="text-input" value={preset} onChange={e => setPreset(e.target.value)}>
                  {list.presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            {error && <div className="alert-error">⚠️ {error}</div>}
            <button className="btn-primary" onClick={() => act({ action: 'create', title, preset })}>CREATE QUIZ & GENERATE CODE</button>

            {list.rooms.length > 0 && (
              <>
                <h2 className="review-title" style={{ margin: '30px 0 12px' }}>Your quizzes</h2>
                {list.rooms.map(r => (
                  <div key={r.code} className="lead-room" onClick={() => setCode(r.code)}>
                    <strong className="code-chip">{r.code}</strong>
                    <span>{r.title}</span>
                    <span className={`lb-state ${r.status}`}>{r.status}</span>
                    <small>{r.count} joined</small>
                    <button className="mini no" onClick={e => { e.stopPropagation(); confirmDelete(r.code, r.title); }}>Delete</button>
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        {auth && code && room && (
          <>
            <section className="card">
              <div className="lead-head">
                <div>
                  <button className="btn-secondary" onClick={() => { setCode(''); setRoom(null); }}>← All quizzes</button>
                  <h1 className="hero-title" style={{ fontSize: 26, marginTop: 14 }}>{room.title}</h1>
                  <p className="hero-subtitle" style={{ margin: 0 }}>{room.preset} · {room.durationSeconds / 60} min per participant</p>
                </div>
                <div className="code-box">
                  <span>JOIN CODE</span>
                  <strong>{room.code}</strong>
                  <em className={`lb-state ${room.status}`}>{room.status.toUpperCase()}</em>
                  {qr && <a href={qr} download={`quiz-${code}-qr.png`} title="Click to download"><img src={qr} alt={`QR to join quiz ${code}`} width={140} height={140} style={{ marginTop: 8, borderRadius: 8 }} /></a>}
                  <small style={{ color: 'var(--text-muted)' }}>Scan to join</small>
                </div>
              </div>
              {error && <div className="alert-error" style={{ marginTop: 14 }}>⚠️ {error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                {room.status === 'lobby' && (
                  <button className="btn-primary" style={{ width: 'auto' }} onClick={() => act({ action: 'start', code })}>▶ START QUIZ</button>
                )}
                {room.status === 'live' && (
                  <button className="btn-secondary" onClick={() => confirm('End this quiz? New starts will be blocked.') && act({ action: 'end', code })}>■ End quiz</button>
                )}
                <button className="btn-secondary" style={{ color: 'var(--error)' }} onClick={() => confirmDelete(code, room.title, true)}>🗑 Delete quiz</button>
                <a className="btn-secondary" href={`/api/leader/export?code=${code}`} download>⬇ Download results (Excel .xlsx)</a>
                {pending.length > 0 && (
                  <button className="btn-secondary" onClick={() => act({ action: 'approve', code, pid: 'all' })}>✓ Approve all pending ({pending.length})</button>
                )}
              </div>
            </section>

            <section className="card" style={{ marginTop: 20 }}>
              <h2 className="review-title">Participants ({room.people.length})</h2>
              {room.people.length === 0 && <p className="lb-empty">Waiting for participants to join with the code…</p>}
              <div className="lead-table">
                {room.people.map(p => (
                  <div key={p.pid} className="lead-person">
                    <span className="lb-avatar">{p.avatar}</span>
                    <span className="lb-who">
                      <strong>{p.name}</strong>
                      <small>{p.email} · {p.phone}</small>
                      <small>{p.college} · {p.department}</small>
                    </span>
                    <span className={`lb-state ${p.approval}`}>{p.approval}{p.state !== 'idle' ? ` · ${p.state}` : ''}</span>
                    <span className="lead-actions">
                      {p.approval !== 'approved' && <button className="mini ok" onClick={() => act({ action: 'approve', code, pid: p.pid })}>Approve</button>}
                      {p.approval !== 'rejected' && p.state === 'idle' && <button className="mini no" onClick={() => act({ action: 'reject', code, pid: p.pid })}>Reject</button>}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card" style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <h2 className="review-title" style={{ margin: 0 }}>🏆 Live Leaderboard</h2>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={toggleFullScreen}
                  title="Project on PPT or screen in full screen"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800 }}
                >
                  <span>⛶</span> Full Screen (PPT Mode)
                </button>
              </div>
              <Leaderboard rows={room.board} />
            </section>

            {/* FULLSCREEN PROJECTOR OVERLAY FOR PPT / AUDITORIUM */}
            {fullScreen && (
              <div className="projector-fullscreen">
                <header className="projector-header">
                  <div className="projector-brand">
                    <img src="/logo.png" alt="IEEE EMBS Logo" className="projector-logo" />
                    <div className="projector-title-block">
                      <h1>IEEE EMBS VIT Student Chapter Pune</h1>
                      <p>{room.title} · Live Leaderboard Stage</p>
                    </div>
                  </div>

                  <div className="projector-center">
                    <div className="projector-code-pill">
                      <span>JOIN CODE:</span>
                      <strong>{room.code}</strong>
                    </div>
                    <div className="projector-live-pulse">
                      <span className="pulse-dot-green"></span>
                      <span>{room.status === 'live' ? 'QUIZ LIVE' : room.status.toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="projector-actions">
                    <button
                      type="button"
                      className="btn-projector-exit"
                      onClick={toggleFullScreen}
                    >
                      ✕ Exit Full Screen (Esc)
                    </button>
                  </div>
                </header>

                {/* PODIUM SECTION (IF FINISHED PARTICIPANTS EXIST) */}
                {(() => {
                  const finished = (room.board || []).filter(r => r.state === 'finished' && r.rank);
                  if (finished.length === 0) return null;

                  const r1 = finished.find(r => r.rank === 1);
                  const r2 = finished.find(r => r.rank === 2);
                  const r3 = finished.find(r => r.rank === 3);

                  return (
                    <div className="projector-podium">
                      {r2 && (
                        <div className="podium-card rank-2">
                          <div className="podium-medal">🥈</div>
                          <div className="podium-avatar">{r2.avatar}</div>
                          <div className="podium-name">{r2.name}</div>
                          <div className="podium-inst">{r2.college} · {r2.department}</div>
                          <div className="podium-score">{r2.score}/{r2.total}</div>
                          <div className="podium-time">{String(Math.floor(r2.elapsedSec / 60)).padStart(2, '0')}:{String(Math.floor(r2.elapsedSec % 60)).padStart(2, '0')}</div>
                        </div>
                      )}
                      {r1 && (
                        <div className="podium-card rank-1">
                          <div className="podium-medal">🥇</div>
                          <div className="podium-avatar">{r1.avatar}</div>
                          <div className="podium-name">{r1.name}</div>
                          <div className="podium-inst">{r1.college} · {r1.department}</div>
                          <div className="podium-score">{r1.score}/{r1.total}</div>
                          <div className="podium-time">{String(Math.floor(r1.elapsedSec / 60)).padStart(2, '0')}:{String(Math.floor(r1.elapsedSec % 60)).padStart(2, '0')}</div>
                        </div>
                      )}
                      {r3 && (
                        <div className="podium-card rank-3">
                          <div className="podium-medal">🥉</div>
                          <div className="podium-avatar">{r3.avatar}</div>
                          <div className="podium-name">{r3.name}</div>
                          <div className="podium-inst">{r3.college} · {r3.department}</div>
                          <div className="podium-score">{r3.score}/{r3.total}</div>
                          <div className="podium-time">{String(Math.floor(r3.elapsedSec / 60)).padStart(2, '0')}:{String(Math.floor(r3.elapsedSec % 60)).padStart(2, '0')}</div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* FULL TABLE OF ALL PARTICIPANTS */}
                {(!room.board || room.board.length === 0) ? (
                  <div className="projector-empty">
                    Waiting for approved participants to join and play with code <strong>{room.code}</strong>…
                  </div>
                ) : (
                  <div className="projector-list">
                    {room.board.map(r => {
                      const isTop = r.rank && r.rank <= 3;
                      const medal = r.rank ? (['🥇', '🥈', '🥉'][r.rank - 1] || `#${r.rank}`) : '–';
                      const mm = Math.floor((r.elapsedSec || 0) / 60);
                      const ss = Math.floor((r.elapsedSec || 0) % 60);
                      const timeStr = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

                      return (
                        <div key={r.pid} className={`projector-row ${isTop ? 'top-row' : ''}`}>
                          <div className="projector-rank">{medal}</div>
                          <div className="projector-avatar">{r.avatar}</div>
                          <div className="projector-who">
                            <strong>{r.name}</strong>
                            <small>{r.college} · {r.department}</small>
                          </div>
                          {r.state === 'finished' ? (
                            <div className="projector-score-badge">
                              <span>{r.status === 'DISQUALIFIED' ? 'DISQUALIFIED' : `${r.score} / ${r.total}`}</span>
                              <small>Time: {timeStr}</small>
                            </div>
                          ) : (
                            <span className={`lb-state ${r.state}`}>
                              {r.state === 'playing' ? '● PLAYING' : 'READY'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
