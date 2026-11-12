// What the chatbot knows: live office data from the database (hours, services, documents) plus the text files in server/knowledge.
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from './db.js';
import { getSettings } from './settings.js';
import { to12 } from './time.js';
import { embed, ollamaEnabled } from './ollama.js';
import { chunkText, buildKeywordIndex, keywordSearch, vectorSearch, safeFileName } from './ragLogic.js';

export const KNOWLEDGE_DIR = path.resolve(process.env.KNOWLEDGE_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../knowledge'));
export const MAX_FILE_BYTES = 300 * 1024;
const STALE_MS = 5 * 60 * 1000; // live office data is re-read at most every 5 minutes
const vecCache = new Map();     // passage text hash -> embedding, so only changed passages are embedded again
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');

export const officeInfo = () => ({
  name: process.env.OFFICE_NAME || 'Municipal Civil Registry Office',
  place: process.env.OFFICE_LOCATION || 'Laoag City, Ilocos Norte',
});

let state = { chunks: [], kw: null, vectors: null, mode: 'keyword', builtAt: 0, files: [], embedError: null };
let building = null;
let dirty = true;

/* ---------- Live facts from the database ---------- */
async function databaseFacts() {
  const st = await getSettings();
  const o = officeInfo();
  const [services] = await pool.query('SELECT id, purpose, grp, summary, note, duration_minutes FROM services WHERE is_active=1 ORDER BY sort_order, id');
  const [reqs] = await pool.query("SELECT service_id, label, detail, kind FROM service_requirements WHERE is_active=1 ORDER BY kind='conditional', sort_order, id");
  const contact = [process.env.OFFICE_PHONE && `Phone: ${process.env.OFFICE_PHONE}`, process.env.OFFICE_EMAIL && `Email: ${process.env.OFFICE_EMAIL}`].filter(Boolean);

  const docs = [];
  docs.push({ name: 'Office information', text: [
    '# Office hours and location',
    `The ${o.name} is in ${o.place}.`,
    `Office hours: Monday to Friday, ${to12(st.office_open)} to ${to12(st.office_close)}.`,
    `Online appointment hours: Monday to Friday, ${to12(st.booking_start)} to ${to12(st.booking_end)}.`,
    `Online appointments can be booked up to ${st.max_days_ahead} days ahead. The office is closed on weekends and on dates it announces as closed.`,
    'Walk-in clients are welcome during office hours.',
    ...contact,
  ].join('\n\n') });
  docs.push({ name: 'How to book and track', text: [
    '# How to book an appointment online',
    'Step 1: open the Appointment page on this website and choose your service.',
    'Step 2: review the documents to bring and confirm that you have read them.',
    'Step 3: enter your name, email address and Philippine mobile number. We email a 6-digit code to verify your email address.',
    'Step 4: pick a date, then an hour that still has slots left. The exact start time inside that hour is assigned automatically and shown on your confirmation.',
    'Step 5: you receive a confirmation email with your reference code and the list of documents to bring. Arrive 10 minutes early and bring a valid ID.',
    '# How to check or track your appointment',
    'Open the Track Appointment page and enter your reference code. The status is Pending, Confirmed, In progress, Completed or Cancelled. If an appointment was cancelled, you can book another time or contact the office. Keep your reference code private.',
  ].join('\n\n') });
  docs.push({ name: 'Services', text: [
    '# Services offered',
    `The office offers these services: ${services.map((s) => s.purpose).join(', ')}.`,
    st.checklist_notice,
  ].join('\n\n') });
  for (const s of services) {
    const mine = reqs.filter((r) => r.service_id === s.id);
    const must = mine.filter((r) => r.kind === 'mandatory').map((r) => `- ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
    const maybe = mine.filter((r) => r.kind === 'conditional').map((r) => `- ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
    docs.push({ name: `Service: ${s.purpose}`, text: [
      `# ${s.purpose}`,
      `Group: ${s.grp}. A visit takes about ${s.duration_minutes} minutes.`,
      s.summary,
      must.length ? `Documents to bring for ${s.purpose}:\n${must.join('\n')}` : '',
      maybe.length ? `Documents that may also be needed for ${s.purpose}, depending on the situation:\n${maybe.join('\n')}` : '',
      s.note ? `Note: ${s.note}` : '',
    ].filter(Boolean).join('\n\n') });
  }
  return docs;
}

/* ---------- Files in server/knowledge ---------- */
async function readFiles() {
  await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
  const out = [];
  for (const name of await fs.readdir(KNOWLEDGE_DIR)) {
    if (!safeFileName(name) || name.startsWith('_') || /^readme/i.test(name)) continue; // README and files starting with _ are notes for you, not knowledge
    const full = path.join(KNOWLEDGE_DIR, name);
    const stat = await fs.stat(full);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
    out.push({ name, text: await fs.readFile(full, 'utf8'), updated: stat.mtime });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------- Building the searchable index ---------- */
async function build() {
  const [facts, files] = await Promise.all([databaseFacts(), readFiles()]);
  const chunks = [];
  for (const d of facts) chunks.push(...chunkText(d.name, d.text));
  const fileInfo = [];
  for (const f of files) {
    const c = chunkText(f.name, f.text);
    chunks.push(...c);
    fileInfo.push({ name: f.name, chars: f.text.length, chunks: c.length, updated: f.updated });
  }
  const kw = buildKeywordIndex(chunks);
  let vectors = null, mode = 'keyword', embedError = null;
  if (ollamaEnabled() && chunks.length) {
    try {
      const texts = chunks.map((c) => `${c.source}${c.heading ? ' > ' + c.heading : ''}\n${c.text}`);
      const keys = texts.map(hash);
      const missing = [...new Set(keys.filter((k) => !vecCache.has(k)))];
      for (let i = 0; i < missing.length; i += 16) {
        const batch = missing.slice(i, i + 16);
        const vecs = await embed(batch.map((k) => texts[keys.indexOf(k)]));
        batch.forEach((k, j) => vecCache.set(k, vecs[j]));
      }
      const live = new Set(keys);
      for (const k of vecCache.keys()) if (!live.has(k)) vecCache.delete(k);
      vectors = keys.map((k) => vecCache.get(k));
      mode = 'embeddings';
    } catch (e) { embedError = e.message; } // no embedding model: keyword search still works
  }
  state = { chunks, kw, vectors, mode, builtAt: Date.now(), files: fileInfo, embedError };
  dirty = false;
}

async function ensureFresh(force = false) {
  const stale = force || dirty || Date.now() - state.builtAt > STALE_MS;
  if (!stale) return state;
  if (!building) {
    building = build()
      .catch((e) => { console.error('Chatbot knowledge rebuild failed:', e.message); if (!state.builtAt) throw e; })
      .finally(() => { building = null; });
  }
  if (!state.builtAt || force) await building; // the first build must finish; later rebuilds happen in the background
  return state;
}

export async function search(query, k = 4) {
  const s = await ensureFresh();
  if (s.mode === 'embeddings' && s.vectors) {
    try {
      const [qv] = await embed([query]);
      return { mode: 'embeddings', results: vectorSearch(s.chunks, s.vectors, qv, k) };
    } catch (e) { console.error('Could not embed the question, using keyword search:', e.message); }
  }
  return { mode: 'keyword', results: keywordSearch(s.kw, s.chunks, query, k) };
}

// Called when an admin edits services, so the chatbot's live office data catches up without waiting for the 5 minute refresh.
export const refreshSoon = () => { dirty = true; ensureFresh(true).catch(() => {}); };
export const warmUp = () => ensureFresh(true).catch((e) => console.error('Chatbot knowledge not ready yet:', e.message));
export const reindex = async () => { dirty = true; return ensureFresh(true); };
export const knowledgeStatus = async () => {
  const s = await ensureFresh();
  return { mode: s.mode, embedError: s.embedError, chunks: s.chunks.length, files: s.files, builtAt: s.builtAt };
};

/* ---------- Managing the files (admin) ---------- */
const fileOr400 = (name) => { const n = safeFileName(name); if (!n) throw Object.assign(new Error('Use a file name like fees-and-payments.md (letters, numbers, spaces, - and _; ending in .md or .txt).'), { status: 400 }); return n; };
export async function readKnowledgeFile(name) {
  const n = fileOr400(name);
  try { return await fs.readFile(path.join(KNOWLEDGE_DIR, n), 'utf8'); } catch { throw Object.assign(new Error('File not found'), { status: 404 }); }
}
export async function writeKnowledgeFile(name, content) {
  const n = fileOr400(name);
  if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw Object.assign(new Error('That file is too large (300 KB maximum).'), { status: 400 });
  await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
  await fs.writeFile(path.join(KNOWLEDGE_DIR, n), content, 'utf8');
  await reindex();
}
export async function deleteKnowledgeFile(name) {
  const n = fileOr400(name);
  try { await fs.unlink(path.join(KNOWLEDGE_DIR, n)); } catch { throw Object.assign(new Error('File not found'), { status: 404 }); }
  await reindex();
}
