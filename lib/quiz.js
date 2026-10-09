import { google } from 'googleapis';
import crypto from 'crypto';
import { BANK } from './bank.js';

// The two preset tests a leader picks from (ids in lib/bank.js). Each runs for `minutes` per participant.
export const PRESETS = {
  'set-1': { name: 'Test 1 · 35 MCQs (16 Easy / 12 Medium / 7 Tough)', minutes: 35, from: 1, to: 35 },
  'set-2': { name: 'Test 2 · 35 MCQs (16 Easy / 12 Medium / 7 Tough)', minutes: 35, from: 101, to: 135 },
};
export const durationSec = preset => PRESETS[preset].minutes * 60;
const MAX_SCORE = 35;

let sheets = null;
if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
  } catch (e) {
    console.warn('Google Sheets initialization failed:', e.message);
  }
}

export function shuffle(arr, rnd = Math.random) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const eventQuestions = preset => BANK.filter(q => q.id >= PRESETS[preset].from && q.id <= PRESETS[preset].to);

// Stateless session: signed token carrying name/contact/start/ids.
const QUIZ_SECRET = process.env.QUIZ_SECRET || 'ieee-embs-vit-pune-quiz-secret-key-2026';
const sig = p => crypto.createHmac('sha256', QUIZ_SECRET).update(p).digest('base64url');

export const signToken = obj => {
  const p = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${p}.${sig(p)}`;
};

export function verifyToken(t) {
  const [p, s] = String(t || '').split('.');
  if (!p || !s) return null;
  const a = Buffer.from(sig(p)), b = Buffer.from(s);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return JSON.parse(Buffer.from(p, 'base64url').toString());
}

const HEADERS = {
  Responses: ['Time', 'Name', 'Email | Phone', 'Score', 'Percent', 'Seconds', 'Status', 'Participant ID', 'Tab switches', 'Millis', 'Answers', 'Quiz code', 'College', 'Department'],
  Participants: ['Time', 'Quiz code', 'Participant ID', 'Name', 'Email', 'Phone', 'College', 'Department', 'Avatar'],
  Log: ['Time', 'Quiz code', 'Event', 'Detail', 'By'],
};

// Appends one row; creates the tab (with a header row) if it doesn't exist yet.
export async function appendRow(range, row) {
  if (!sheets || !process.env.SHEET_ID) {
    console.log(`[Dev/Local Mode] ${range}:`, row);
    return;
  }
  const spreadsheetId = process.env.SHEET_ID;
  const append = values =>
    sheets.spreadsheets.values.append({
      spreadsheetId, range, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values },
    });
  try {
    await append([row]);
  } catch (err) {
    const tab = range.split('!')[0];
    if (!/Unable to parse range/i.test(err.message)) return console.error('Google Sheets append error:', err.message);
    try {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } });
      await append(HEADERS[tab] ? [HEADERS[tab], row] : [row]);
    } catch (e) {
      console.error('Google Sheets append error:', e.message);
    }
  }
}

export const logEvent = (code, event, detail = '', by = '') =>
  appendRow('Log!A:E', [new Date().toISOString(), code, event, detail, by]);

export function score(questionIds, answers) {
  let s = 0;
  const log = {};
  const review = [];
  const total = questionIds?.length || MAX_SCORE;

  for (const q of BANK) {
    if (!questionIds.includes(q.id)) continue;
    const sel = answers[String(q.id)] ?? null;
    log[q.id] = sel;
    const correctOption = q.o[q.a];
    const isCorrect = sel != null && String(sel) === correctOption;
    if (isCorrect) s++;

    review.push({
      id: q.id,
      difficulty: q.d,
      question: q.q,
      options: q.o,
      selectedAnswer: sel,
      correctAnswer: correctOption,
      isCorrect,
      explanation: q.exp,
    });
  }

  // Preserve the exact event question sequence
  review.sort((a, b) => questionIds.indexOf(a.id) - questionIds.indexOf(b.id));

  return {
    score: s,
    total,
    log,
    review,
    percentage: Math.round((s / total) * 10000) / 100,
  };
}
