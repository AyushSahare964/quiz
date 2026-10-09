'use client';
import { useEffect, useRef, useState } from 'react';
import Leaderboard from './Leaderboard';

const KEY = 'bmeQuizSession';
const JOIN_KEY = 'bmeJoinToken';
const AVATARS = ['🧑‍⚕️', '🫀', '🧠', '🔬', '🧬', '🩺', '💉', '🦾', '🧪', '🩻', '🫁', '🦴'];

const HERO_PHRASES = [
  'Biomedical Engineering Challenge',
  'Biosignals & Instrumentation Challenge',
  'Medical Imaging & Diagnostics Challenge',
  'Clinical Safety & Bio-Sensors Challenge',
];

function useTypewriter(phrases, typeDuration = 1800, pauseDuration = 3200) {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(() => (phrases[0] ? phrases[0].length : 0));
  const [isReverse, setIsReverse] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    // On first load, display the primary title for the pause duration, then begin cycling
    if (!hasStarted) {
      const initTimer = setTimeout(() => {
        setHasStarted(true);
        setIsReverse(true);
      }, pauseDuration);
      return () => clearTimeout(initTimer);
    }

    if (!phrases || phrases.length === 0) return;
    const currentWord = phrases[index % phrases.length];

    const charTypeSpeed = Math.max(30, Math.floor(typeDuration / currentWord.length));
    const charDeleteSpeed = 22;

    if (!isReverse && subIndex === currentWord.length) {
      const timeout = setTimeout(() => {
        setIsReverse(true);
      }, pauseDuration);
      return () => clearTimeout(timeout);
    }

    if (isReverse && subIndex === 0) {
      setIsReverse(false);
      setIndex(prev => (prev + 1) % phrases.length);
      return;
    }

    const timeout = setTimeout(() => {
      setSubIndex(prev => prev + (isReverse ? -1 : 1));
    }, isReverse ? charDeleteSpeed : charTypeSpeed);

    return () => clearTimeout(timeout);
  }, [subIndex, index, isReverse, phrases, typeDuration, pauseDuration, hasStarted]);

  const currentWord = phrases[index % phrases.length];
  return currentWord.substring(0, subIndex);
}

const mmss = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const precise = sec => {
  const t = Math.max(0, Number(sec) || 0), m = Math.floor(t / 60);
  return String(m).padStart(2, '0') + ':' + (t - m * 60).toFixed(2).padStart(5, '0');
};

async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

export default function Page() {
  const [phase, setPhase] = useState('intro'); // 'intro' | 'lobby' | 'quiz' | 'result'
  const [form, setForm] = useState({ code: '', name: '', email: '', phone: '', college: '', department: '', avatar: AVATARS[0] });
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const [joinToken, setJoinToken] = useState('');
  const [lobby, setLobby] = useState(null); // /api/room view: room, me, board
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [tentative, setTentative] = useState({});
  const [current, setCurrent] = useState(0);
  const [tabs, setTabs] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState(null);

  // Dynamic Typewriter Text for Hero
  const animatedTitle = useTypewriter(HERO_PHRASES, 1800, 3200);

  // Settings
  const [showLiveExplanation, setShowLiveExplanation] = useState(true);
  const [reviewFilter, setReviewFilter] = useState('all'); // 'all' | 'correct' | 'incorrect'

  // Refs so event handlers / timers always see the latest values.
  const live = useRef({});
  live.current = { session, answers, tabs };
  const submitting = useRef(false);

  // Resume after refresh if session still valid.
  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (s?.session?.token && Date.now() - s.session.serverStartMs < s.session.durationSeconds * 1000) {
        setSession(s.session);
        setAnswers(s.answers || {});
        setTentative(s.tentative || s.answers || {});
        setCurrent(Math.min(s.current || 0, s.session.questions.length - 1));
        setTabs(s.tabs || 0);
        setPhase('quiz');
      }
    } catch {}
    try {
      const t = localStorage.getItem(JOIN_KEY);
      if (t) { setJoinToken(t); setPhase(p => (p === 'intro' ? 'lobby' : p)); }
    } catch {}
  }, []);

  // Poll approval / quiz start / live leaderboard while waiting or after finishing.
  useEffect(() => {
    if (!joinToken || (phase !== 'lobby' && phase !== 'result')) return;
    let dead = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/room?token=${encodeURIComponent(joinToken)}`);
        const d = await r.json();
        if (dead) return;
        if (!r.ok) {
          localStorage.removeItem(JOIN_KEY);
          setJoinToken(''); setPhase('intro'); setError(d.message);
          return;
        }
        setLobby(d);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => { dead = true; clearInterval(id); };
  }, [joinToken, phase]);

  // Persist progress.
  useEffect(() => {
    if (session && phase === 'quiz') {
      sessionStorage.setItem(KEY, JSON.stringify({ session, answers, tentative, current, tabs }));
    }
  }, [session, answers, tentative, current, tabs, phase]);

  useEffect(() => {
    document.body.classList.toggle('quiz-live', phase === 'quiz');
    document.body.classList.toggle('intro-mode', phase === 'intro');
  }, [phase]);

  // Countdown timer.
  useEffect(() => {
    if (phase !== 'quiz' || !session) return;
    const tick = () => {
      const r = Math.max(0, session.durationSeconds - Math.floor((Date.now() - session.serverStartMs) / 1000));
      setRemaining(r);
      if (r <= 0 && !submitting.current) {
        clearInterval(id);
        alert('Time is up. Your quiz is being submitted automatically.');
        submit();
      }
    };
    const id = setInterval(tick, 250);
    tick();
    return () => clearInterval(id);
  }, [phase, session]);

  // Tab switch detection & integrity safeguards.
  useEffect(() => {
    if (phase !== 'quiz') return;
    const onVis = () => {
      if (!document.hidden || submitting.current) return;
      const n = live.current.tabs + 1;
      live.current.tabs = n;
      setTabs(n);
      if (n < 5) {
        alert(`⚠️ Tab switch detected.\n\nWarning ${n} of 4.\n\n${5 - n} more tab switch(es) will automatically disqualify your attempt.`);
      } else {
        alert('⛔ Fifth tab switch detected.\n\nYour attempt will now be submitted as DISQUALIFIED.');
        submit();
      }
    };

    const block = e => e.preventDefault();
    const key = e => {
      if ((e.ctrlKey || e.metaKey) && 'cxv'.includes(String(e.key).toLowerCase())) {
        e.preventDefault();
      }
    };
    const evs = ['contextmenu', 'copy', 'cut', 'paste', 'dragstart', 'selectstart'];

    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('keydown', key);
    evs.forEach(e => document.addEventListener(e, block));

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('keydown', key);
      evs.forEach(e => document.removeEventListener(e, block));
    };
  }, [phase]);

  async function join() {
    setError('');
    setBusy(true);
    try {
      const res = await post('/api/join', form);
      localStorage.setItem(JOIN_KEY, res.token);
      setJoinToken(res.token);
      setPhase('lobby');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function beginQuiz() {
    setError('');
    setBusy(true);
    try {
      const res = await post('/api/start', { token: joinToken });
      setSession(res);
      setAnswers({});
      setTentative({});
      setCurrent(0);
      setTabs(0);
      submitting.current = false;
      setPhase('quiz');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function setAvatar(avatar) {
    setLobby(await post('/api/room', { token: joinToken, avatar }));
  }

  function leave() {
    localStorage.removeItem(JOIN_KEY);
    location.reload();
  }

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    const { session: s, answers: a, tabs: t } = live.current;
    try {
      const res = await post('/api/submit', { token: s.token, answers: a, tabSwitches: t });
      if (res.ok === false && res.code === 'DUPLICATE') {
        alert(res.message);
        sessionStorage.removeItem(KEY);
        return location.reload();
      }
      sessionStorage.removeItem(KEY);
      setResult(res);
      setPhase('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      submitting.current = false;
      setBusy(false);
      if (confirm(e.message + '\n\nRetry submission now? Your answers remain saved in this tab.')) {
        submit();
      }
    }
  }

  function confirmSubmit() {
    const left = session.questions.length - Object.keys(answers).length;
    if (left > 0 && !confirm(`You have ${left} unanswered question(s). Are you sure you want to submit?`)) return;
    submit();
  }

  const q = session?.questions[current];
  const last = session && current === session.questions.length - 1;
  const go = d => {
    setCurrent(c => Math.max(0, Math.min(session.questions.length - 1, c + d)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resultMsg = {
    VALID: ['SUBMITTED & VALIDATED', 'success', 'Your response has been recorded successfully.'],
    DISQUALIFIED: ['DISQUALIFIED', 'error', 'This attempt was recorded as disqualified because 5 tab switches were detected.'],
    LATE: ['SUBMITTED — LATE', 'warn', 'Your response was submitted after the time limit. Organizer review required.'],
  }[result?.status] || ['COMPLETED', 'success', 'Quiz completed.'];

  const diffClass = d => {
    if (d === 'Easy') return 'diff-easy';
    if (d === 'Medium') return 'diff-medium';
    return 'diff-tough';
  };

  // Build review items for result view
  const reviewItems = result?.review || (session?.questions || []).map(item => {
    const chosen = answers[item.id] ?? null;
    const isCorrect = chosen != null && chosen === item.correctAnswer;
    return {
      id: item.id,
      difficulty: item.difficulty,
      question: item.question,
      options: item.options,
      selectedAnswer: chosen,
      correctAnswer: item.correctAnswer,
      isCorrect,
      explanation: item.explanation,
    };
  });

  const filteredReview = reviewItems.filter(item => {
    if (reviewFilter === 'correct') return item.isCorrect;
    if (reviewFilter === 'incorrect') return !item.isCorrect;
    return true;
  });

  const correctCount = reviewItems.filter(i => i.isCorrect).length;
  const incorrectCount = reviewItems.length - correctCount;

  return (
    <>
      {/* ========================================================
          MAIN QUIZ APPLICATION CONTAINER
          ======================================================== */}
      <main className="site-main">
        <div className="shell">
          {/* PHASE 1: INTRO / REGISTRATION (COMPACT 1-PAGE FIT) */}
          {phase === 'intro' && (
            <section className="card intro-card">
              <div className="hero-header" style={{ marginBottom: 12 }}>
                <div>
                  <span className="hero-chapter-tag" style={{ marginBottom: 4, padding: '3px 10px', fontSize: 11 }}>
                    ⚡ IEEE EMBS VIT Student Chapter Pune
                  </span>
                </div>

                {/* Animated Typing Header with Fixed Set Time & Caret */}
                <h1 className="hero-title" style={{ fontSize: 24, marginBottom: 4 }}>
                  <span>{animatedTitle}</span>
                  <span className="typing-cursor">|</span>
                </h1>

                <p className="hero-subtitle" style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.4 }}>
                  Test your engineering & physiological problem-solving across instrumentation, biosignals, imaging, and safety.
                </p>
              </div>

              <div className="grid-inputs-3">
                <div className="field-group">
                  <label htmlFor="code" className="field-label">Quiz Join Code</label>
                  <input
                    id="code"
                    className="text-input"
                    autoComplete="off"
                    placeholder="e.g. K7M2QX"
                    value={form.code}
                    onChange={setF('code')}
                    style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 800, textAlign: 'center' }}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="name" className="field-label">Full Name</label>
                  <input
                    id="name"
                    className="text-input"
                    autoComplete="name"
                    placeholder="e.g. Aditi Sharma"
                    value={form.name}
                    onChange={setF('name')}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="phone" className="field-label">Phone No.</label>
                  <input
                    id="phone"
                    className="text-input"
                    autoComplete="tel"
                    placeholder="e.g. 9876543210"
                    value={form.phone}
                    onChange={setF('phone')}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="email" className="field-label">Email Address</label>
                  <input
                    id="email"
                    className="text-input"
                    autoComplete="email"
                    placeholder="e.g. aditi.sharma@vit.edu"
                    value={form.email}
                    onChange={setF('email')}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="college" className="field-label">College Name</label>
                  <input
                    id="college"
                    className="text-input"
                    autoComplete="organization"
                    placeholder="e.g. VIT Pune"
                    value={form.college}
                    onChange={setF('college')}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="department" className="field-label">Department</label>
                  <input
                    id="department"
                    className="text-input"
                    autoComplete="off"
                    placeholder="e.g. Biomedical Engg"
                    value={form.department}
                    onChange={setF('department')}
                  />
                </div>
              </div>

              <div className="avatar-compact-row">
                <span className="field-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Choose Avatar:</span>
                <div className="avatar-grid">
                  {AVATARS.map(a => (
                    <button
                      key={a}
                      type="button"
                      className={`avatar-pick ${form.avatar === a ? 'on' : ''}`}
                      onClick={() => setForm(f => ({ ...f, avatar: a }))}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rules-chips-row">
                <span className="rules-chip">📋 15 MCQs (7 Easy • 5 Med • 3 Tough)</span>
                <span className="rules-chip">⏱ 20-Min Timer</span>
                <span className="rules-chip">✓ 1 Mark / No Negative</span>
                <span className="rules-chip">💡 Instant Explanations</span>
                <span className="rules-chip">🛡️ Tab Guard (Max 4 warnings)</span>
              </div>

              {error && <div className="alert-error" style={{ margin: '8px 0', padding: '8px 14px', fontSize: 13 }}>⚠️ {error}</div>}

              <button className="btn-primary" style={{ padding: '12px 24px', fontSize: 15, marginTop: 4 }} disabled={busy} onClick={join}>
                {busy ? 'JOINING…' : 'JOIN QUIZ 🚀'}
              </button>
            </section>
          )}

          {/* PHASE 1b: LOBBY — profile, approval, live leaderboard */}
          {phase === 'lobby' && lobby && (
            <>
              <section className="card">
                <div className="profile-row">
                  <div className="profile-avatar">{lobby.me.avatar}</div>
                  <div style={{ flex: 1 }}>
                    <h1 className="hero-title" style={{ fontSize: 26, textAlign: 'left', marginBottom: 2 }}>{lobby.me.name}</h1>
                    <div className="profile-meta">{lobby.me.college} · {lobby.me.department}</div>
                    <div className="profile-meta">{lobby.me.email} · {lobby.me.phone}</div>
                    <div className="profile-meta">Quiz: <strong>{lobby.room.title}</strong> · Code <strong>{lobby.room.code}</strong></div>
                  </div>
                  <button className="btn-secondary" onClick={leave}>Leave</button>
                </div>
                <div className="avatar-grid" style={{ margin: '18px 0' }}>
                  {AVATARS.map(a => (
                    <button key={a} type="button" className={`avatar-pick ${lobby.me.avatar === a ? 'on' : ''}`} onClick={() => setAvatar(a)}>{a}</button>
                  ))}
                </div>

                {error && <div className="alert-error">⚠️ {error}</div>}
                {lobby.me.approval === 'rejected' ? (
                  <div className="alert-error">⛔ The organizer did not approve your entry.</div>
                ) : lobby.me.finished ? (
                  <div className="alert-error" style={{ background: 'var(--success-bg)', borderColor: 'var(--success-border)', color: 'var(--success)' }}>✓ You have completed this quiz.</div>
                ) : lobby.me.approval === 'pending' ? (
                  <div className="alert-error" style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning-border)', color: 'var(--warning)' }}>⏳ Waiting for the organizer to approve you…</div>
                ) : lobby.room.status === 'lobby' ? (
                  <div className="alert-error" style={{ background: 'var(--success-bg)', borderColor: 'var(--success-border)', color: 'var(--success)' }}>✓ Approved! Waiting for the organizer to start the quiz…</div>
                ) : lobby.room.status === 'ended' ? (
                  <div className="alert-error">The quiz has ended.</div>
                ) : (
                  <button className="btn-primary" disabled={busy} onClick={beginQuiz}>
                    {busy ? 'PREPARING QUIZ…' : lobby.session ? 'RESUME QUIZ ▶' : 'START CHALLENGE 🚀'}
                  </button>
                )}
              </section>

              <section className="card" style={{ marginTop: 20 }}>
                <h2 className="review-title">🏆 Live Leaderboard</h2>
                <Leaderboard rows={lobby.board} me={lobby.board.find(r => r.name === lobby.me.name)?.pid} />
              </section>
            </>
          )}

          {/* PHASE 2: LIVE QUIZ */}
          {phase === 'quiz' && q && (
            <section className="card">
              {/* Top Bar with Timer and Progress */}
              <div className="quiz-top-bar">
                <div className="progress-container">
                  <div className="progress-info">
                    <span>Question {current + 1} of {session.questions.length}</span>
                    <span>{Object.keys(answers).length} / {session.questions.length} Answered</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${((current + 1) / session.questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className={`timer-box ${remaining <= 60 ? 'danger' : remaining <= 300 ? 'warn' : ''}`}>
                  <span>⏱</span>
                  <span>{mmss(remaining)}</span>
                </div>
              </div>

              {/* Quick Jump Palette Matrix */}
              <div className="palette-bar">
                {session.questions.map((item, idx) => {
                  const isAnswered = answers[item.id] !== undefined;
                  const isCurr = idx === current;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCurrent(idx)}
                      className={`palette-pill ${isCurr ? 'current' : ''} ${isAnswered ? 'answered' : ''}`}
                      title={`Go to Question ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Question Metadata */}
              <div className="q-meta-row">
                <span className="q-badge">Question {current + 1}</span>
                <span className={`diff-tag ${diffClass(q.difficulty)}`}>● {q.difficulty}</span>
                <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showLiveExplanation}
                    onChange={e => setShowLiveExplanation(e.target.checked)}
                  />
                  <span>Show explanation on select</span>
                </label>
              </div>

              {/* Question Text */}
              <h2 className="q-text">{q.question}</h2>

              {/* Options */}
              <div className="options-grid">
                {q.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const confirmedAns = answers[q.id];
                  const isConfirmed = confirmedAns !== undefined;
                  const isTentative = tentative[q.id] === opt;
                  const isSelected = isTentative || (tentative[q.id] === undefined && confirmedAns === opt);
                  const isCorrectOption = opt === q.correctAnswer;

                  let stateClass = '';
                  let tag = null;

                  if (showLiveExplanation && isConfirmed) {
                    if (isCorrectOption) {
                      stateClass = 'state-correct';
                      tag = <span className="opt-tag correct">✓ Correct Answer</span>;
                    } else if (confirmedAns === opt) {
                      stateClass = 'state-incorrect';
                      tag = <span className="opt-tag chosen-wrong">✗ Your Choice</span>;
                    }
                  }

                  return (
                    <div
                      key={opt}
                      className={`option-item ${isSelected ? 'selected' : ''} ${stateClass}`}
                      onClick={() => {
                        setTentative(prev => ({ ...prev, [q.id]: opt }));
                      }}
                    >
                      <div className="option-left">
                        <span className="opt-letter">{letter}</span>
                        <span className="opt-label">{opt}</span>
                      </div>
                      {tag}
                    </div>
                  );
                })}
              </div>

              {/* CONFIRM BUTTON SECTION */}
              {(() => {
                const confirmedAns = answers[q.id];
                const isConfirmed = confirmedAns !== undefined;
                const currentChoice = tentative[q.id] !== undefined ? tentative[q.id] : confirmedAns;

                if (!currentChoice) return null;

                if (!isConfirmed) {
                  return (
                    <div className="confirm-box">
                      <button
                        type="button"
                        className="btn-confirm"
                        onClick={() => {
                          setAnswers(prev => ({ ...prev, [q.id]: currentChoice }));
                        }}
                      >
                        <span>✓ Confirm Answer</span>
                      </button>
                      <span className="confirm-note">
                        Selected: <strong>{currentChoice}</strong>. Click confirm to lock in your answer.
                      </span>
                    </div>
                  );
                }

                if (tentative[q.id] !== undefined && tentative[q.id] !== confirmedAns) {
                  return (
                    <div className="confirm-box">
                      <button
                        type="button"
                        className="btn-confirm update"
                        onClick={() => {
                          setAnswers(prev => ({ ...prev, [q.id]: tentative[q.id] }));
                        }}
                      >
                        <span>✓ Update & Confirm Answer</span>
                      </button>
                      <span className="confirm-note">
                        You changed your selection to <strong>{tentative[q.id]}</strong>. Click to update.
                      </span>
                    </div>
                  );
                }

                return (
                  <div className="confirmed-badge-row">
                    <span className="confirmed-pill">
                      <span>✓</span> Answer Confirmed: <strong>{confirmedAns}</strong>
                    </span>
                  </div>
                );
              })()}

              {/* DEDICATED EXPLANATION & CORRECT OPTION CARD */}
              {(showLiveExplanation && answers[q.id] !== undefined) && (
                <div className="explanation-card">
                  <div className="exp-header">
                    <span className="exp-badge">
                      💡 Biomedical Explanation & Insight
                    </span>
                    <span className="exp-correct-target">
                      Correct Answer: <span>{q.correctAnswer}</span>
                    </span>
                  </div>
                  <p className="exp-body">
                    {q.explanation || 'This is the standard physiological and engineering principle for this bio-measurement.'}
                  </p>
                </div>
              )}

              {/* Navigation and Actions */}
              <div className="quiz-actions">
                <button
                  className="btn-secondary"
                  disabled={current === 0 || busy}
                  onClick={() => go(-1)}
                >
                  ← Previous
                </button>

                <div className="nav-btns">
                  {!last ? (
                    <button
                      className="btn-primary"
                      style={{ width: 'auto', padding: '12px 24px' }}
                      disabled={busy}
                      onClick={() => go(1)}
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      style={{ width: 'auto', padding: '12px 24px', background: 'linear-gradient(135deg, #059669, #0284c7)' }}
                      disabled={busy}
                      onClick={confirmSubmit}
                    >
                      Review & Submit Quiz ✓
                    </button>
                  )}
                </div>
              </div>

              {/* Last Question Notice (Minimalist) */}
              {last && (
                <div className="submit-box" style={{ marginTop: 8, padding: '8px 14px', fontSize: 12 }}>
                  <span>⚠️ You are on the final question. Review your responses, then click <strong>Submit Final Quiz</strong> when ready.</span>
                </div>
              )}

              {/* Integrity Warning Bar */}
              <div className="footer-integrity">
                <span>
                  {tabs > 0 ? (
                    <span className="integrity-warning">
                      ⚠️ Integrity Alert: {tabs} tab switch(es) logged. ({5 - tabs} warning(s) remain before disqualification)
                    </span>
                  ) : (
                    <span>🛡️ Session protected: Tab switching and clipboard copy disabled.</span>
                  )}
                </span>
                <span>All responses auto-saved</span>
              </div>
            </section>
          )}

          {/* PHASE 3: RESULT & FULL REVIEW BREAKDOWN */}
          {phase === 'result' && (
            <section className="card result-container">
              <div className="result-hero">
                <div className="result-badge-icon">✓</div>
                <div className={`status-chip ${resultMsg[1]}`}>{resultMsg[0]}</div>
                <h1 className="hero-title" style={{ marginBottom: 6 }}>
                  {result?.name ? `${result.name}'s Results` : 'Quiz Complete'}
                </h1>
                <p className="hero-subtitle">{resultMsg[2]}</p>

                {/* Scorecard metrics */}
                <div className="result-score-panel">
                  <div className="stat-card">
                    <div className="stat-label">Final Score</div>
                    <div className="stat-value highlight">
                      {result?.score ?? correctCount} / {result?.total ?? reviewItems.length}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Accuracy</div>
                    <div className="stat-value">
                      {result?.percentage ?? Math.round((correctCount / reviewItems.length) * 100)}%
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Time Taken</div>
                    <div className="stat-value">
                      {result?.elapsedSec ? precise(result.elapsedSec) : '--:--'}
                    </div>
                  </div>
                </div>
              </div>

              {/* COMPREHENSIVE QUESTION-BY-QUESTION REVIEW */}
              <div className="review-section">
                <div className="review-header">
                  <h2 className="review-title">
                    Detailed Question Review & Explanations ({reviewItems.length})
                  </h2>
                  <div className="filter-buttons">
                    <button
                      className={`filter-btn ${reviewFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setReviewFilter('all')}
                    >
                      All ({reviewItems.length})
                    </button>
                    <button
                      className={`filter-btn ${reviewFilter === 'correct' ? 'active' : ''}`}
                      onClick={() => setReviewFilter('correct')}
                    >
                      Correct ({correctCount})
                    </button>
                    <button
                      className={`filter-btn ${reviewFilter === 'incorrect' ? 'active' : ''}`}
                      onClick={() => setReviewFilter('incorrect')}
                    >
                      Incorrect ({incorrectCount})
                    </button>
                  </div>
                </div>

                <div className="review-list">
                  {filteredReview.map((item, idx) => {
                    return (
                      <div
                        key={item.id}
                        className={`review-card ${item.isCorrect ? 'correct-card' : 'incorrect-card'}`}
                      >
                        <div className="review-top-meta">
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: 14 }}>Question {idx + 1}</span>
                            <span className={`diff-tag ${diffClass(item.difficulty)}`}>● {item.difficulty}</span>
                          </div>
                          <span className={`opt-tag ${item.isCorrect ? 'correct' : 'chosen-wrong'}`}>
                            {item.isCorrect ? '✓ Correct (+1)' : (item.selectedAnswer ? '✗ Incorrect (0/1)' : '○ Unanswered')}
                          </span>
                        </div>

                        <h3 className="review-q-text">{item.question}</h3>

                        <div className="review-options">
                          {item.options.map((opt, i) => {
                            const L = String.fromCharCode(65 + i);
                            const isCorrectAnswer = opt === item.correctAnswer;
                            const isUserChoice = opt === item.selectedAnswer;

                            let optClass = '';
                            let badge = null;

                            if (isCorrectAnswer) {
                              optClass = 'is-correct';
                              badge = <span>✓ Correct Option</span>;
                            } else if (isUserChoice) {
                              optClass = 'user-wrong';
                              badge = <span>✗ Your Choice</span>;
                            }

                            return (
                              <div key={opt} className={`review-opt ${optClass}`}>
                                <span><strong>{L}.</strong> {opt}</span>
                                {badge}
                              </div>
                            );
                          })}
                        </div>

                        <div className="review-explanation">
                          <strong>🔬 Biomedical Scientific Explanation:</strong>
                          <p>{item.explanation}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="review-section">
                <h2 className="review-title">🏆 Live Leaderboard</h2>
                <Leaderboard rows={lobby?.board || result?.board} me={(lobby?.board || result?.board || []).find(r => r.name === result?.name)?.pid} />
              </div>

              <div style={{ marginTop: 36, display: 'flex', justifyContent: 'center', gap: 14 }}>
                <button
                  className="btn-secondary"
                  onClick={() => window.print()}
                >
                  🖨️ Print / Save Summary
                </button>
                <button
                  className="btn-primary"
                  style={{ width: 'auto', padding: '12px 28px' }}
                  onClick={() => { setResult(null); setPhase('lobby'); }}
                >
                  Back to Lobby
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* ========================================================
          FOOTER: SLEEK 1-LINE FOOTER FOR INTRO TO PREVENT SCROLL,
          HIDDEN DURING LIVE QUIZ, FULL INSTITUTIONAL FOOTER FOR LOBBY/RESULTS
          ======================================================== */}
      {phase === 'intro' ? (
        <footer className="minimal-footer">
          <div className="minimal-footer-inner">
            <span className="min-foot-brand">
              © {new Date().getFullYear()} <strong>IEEE EMBS VIT Student Chapter Pune</strong>
            </span>
            <span className="min-foot-dot">•</span>
            <span className="min-foot-inst">Vishwakarma Institute of Technology, Pune</span>
            <span className="min-foot-dot">•</span>
            <span className="min-foot-contact">Contact: embs@vit.edu</span>
          </div>
        </footer>
      ) : phase !== 'quiz' && (
        <footer className="site-footer">
          <div className="footer-top">
            <div className="footer-brand-col">
              <div className="footer-brand-header">
                <img
                  src="/logo.png"
                  alt="IEEE EMBS VIT Student Chapter Pune"
                  className="footer-logo-img"
                />
                <div>
                  <div className="footer-title">IEEE EMBS VIT Student Chapter Pune</div>
                  <div className="footer-sub">Vishwakarma Institute of Technology, Pune</div>
                </div>
              </div>
              <p className="footer-desc">
                The IEEE Engineering in Medicine and Biology Society (EMBS) Student Chapter at VIT Pune fosters biomedical innovation, scientific inquiry, and technological development across healthcare engineering.
              </p>
            </div>

            <div>
              <div className="footer-col-title">Focus Domains</div>
              <ul className="footer-links">
                <li>Biomedical Instrumentation</li>
                <li>Biosignal Processing (ECG/EEG)</li>
                <li>Medical Imaging Physics</li>
                <li>Healthcare AI & Sensors</li>
              </ul>
            </div>

            <div>
              <div className="footer-col-title">Assessment Integrity</div>
              <ul className="footer-links">
                <li>15 Curated Questions</li>
                <li>Anti-Plagiarism Tab Guard</li>
                <li>Instant Scientific Explanations</li>
                <li>Verified Session Scorer</li>
              </ul>
            </div>

            <div>
              <div className="footer-col-title">Institution & Chapter</div>
              <ul className="footer-links">
                <li><strong>Vishwakarma Institute of Technology</strong></li>
                <li>Bibwewadi, Pune - 411037</li>
                <li>IEEE Pune Section • Region 10</li>
                <li>Contact: embs@vit.edu</li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <div className="footer-bottom-inner">
              <div className="footer-copy">
                © {new Date().getFullYear()} <strong>IEEE EMBS VIT Student Chapter Pune</strong>. All rights reserved.
              </div>
              <div className="footer-tagline">
                Advancing Technology for Humanity • IEEE Engineering in Medicine & Biology Society
              </div>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}
