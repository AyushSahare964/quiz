'use client';
import { useEffect, useState } from 'react';

export default function SiteHeader() {
  const [leader, setLeader] = useState(null);
  const [open, setOpen] = useState(false);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/leader/session').then(r => r.json()).then(d => setLeader(d.leader)).catch(() => {});
  }, []);

  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/leader/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) return (location.href = '/leader');
      setError(d.message || 'Login failed.');
    } catch {
      setError('Cannot reach the server. Please try again.');
    }
    setBusy(false);
  }

  async function logout() {
    await fetch('/api/leader/session', { method: 'DELETE' });
    location.href = '/';
  }

  return (
    <header className="site-header">
      <div className="header-container">
        <a className="header-brand" href="/">
          <img src="/logo.png" alt="IEEE EMBS VIT Student Chapter Pune Logo" className="header-logo-img" />
          <div className="header-titles">
            <span className="chapter-full-name">IEEE EMBS VIT Student Chapter Pune</span>
            <span className="chapter-inst-sub">Vishwakarma Institute of Technology, Pune • IEEE Pune Section</span>
          </div>
        </a>

        <div className="header-right">
          <div className="chapter-badge-pill"><span>IEEE Pune Section</span></div>
          {leader ? (
            <>
              <a className="leader-btn" href="/leader">🎛 Dashboard · {leader}</a>
              <button className="leader-btn ghost" onClick={logout}>Logout</button>
            </>
          ) : (
            <button className="leader-btn" onClick={() => setOpen(true)}>🔐 Leader Login</button>
          )}
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <form className="modal-card" onClick={e => e.stopPropagation()} onSubmit={login}>
            <h2>Leader Login</h2>
            <p>Organizers only. Create quizzes, approve participants and run the live leaderboard.</p>
            <div className="field-group">
              <label className="field-label" htmlFor="lid">Leader ID</label>
              <input id="lid" className="text-input" autoFocus autoComplete="username" value={id} onChange={e => setId(e.target.value)} />
            </div>
            <div className="field-group" style={{ marginTop: 14 }}>
              <label className="field-label" htmlFor="lpw">Password</label>
              <input id="lpw" type="password" className="text-input" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <div className="alert-error" style={{ marginTop: 14, marginBottom: 0 }}>⚠️ {error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-primary" disabled={busy || !id || !password}>{busy ? 'SIGNING IN…' : 'SIGN IN'}</button>
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
