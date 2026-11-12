import { Router } from 'express';
import crypto from 'crypto';
import { pool, log } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { answerQuestion } from '../chatbot.js';
import { HttpError, body, text, email, id, afterId } from '../validate.js';

const r = Router();
const MAX_MESSAGES = 300; // per chat, stops a visitor flooding the database

const addMsg = (sid, type, message) =>
  pool.query('INSERT INTO chat_messages (session_id,sender_type,message) VALUES (?,?,?)', [sid, type, message]);

const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

async function visitorSession(req) {
  const [[s]] = await pool.query('SELECT * FROM chat_sessions WHERE id=?', [id(req.params.id, 'chat')]);
  const tok = req.headers['x-visitor-token'];
  if (!s || typeof tok !== 'string' || !same(s.visitor_token, tok)) throw new HttpError(404, 'Chat not found');
  return s;
}

/* ---------- Bot replies (generated in the background; the widget shows "typing" and polls) ---------- */
const queues = new Map();
function scheduleBotReply(sessionId) {
  const prev = queues.get(sessionId) || Promise.resolve();
  const next = prev.then(() => respond(sessionId)).catch((e) => console.error('Bot reply failed:', e)).finally(() => { if (queues.get(sessionId) === next) queues.delete(sessionId); });
  queues.set(sessionId, next); // one reply at a time per chat, in order
}
async function respond(sessionId) {
  const [[s]] = await pool.query('SELECT status FROM chat_sessions WHERE id=?', [sessionId]);
  if (!s || s.status !== 'bot') return;                         // a staff member already took over
  const [rows] = await pool.query('SELECT sender_type, message FROM chat_messages WHERE session_id=? ORDER BY id DESC LIMIT 9', [sessionId]);
  const msgs = rows.reverse();
  const last = msgs.at(-1);
  if (!last || last.sender_type !== 'visitor') return;          // already answered
  const history = msgs.slice(0, -1).map((m) => ({ role: m.sender_type === 'visitor' ? 'user' : 'assistant', content: m.message }));
  const { reply, handoff } = await answerQuestion(last.message, history);
  await addMsg(sessionId, 'bot', reply);
  if (handoff) {
    await pool.query("UPDATE chat_sessions SET status='waiting_handoff' WHERE id=? AND status='bot'", [sessionId]);
    log('Chatbot', `Chat #${sessionId} waiting for a human`);
  }
}

/* ---------- Visitor ---------- */
r.post('/sessions', async (req, res) => {
  const b = body(req);
  const nm = text(b.name, 'Name', { max: 120, optional: true }) || 'Visitor';
  const em = b.email ? email(b.email, { optional: true }) : null;
  const token = crypto.randomBytes(24).toString('hex');
  const [ins] = await pool.query('INSERT INTO chat_sessions (visitor_name,visitor_email,visitor_token) VALUES (?,?,?)', [nm, em, token]);
  await addMsg(ins.insertId, 'bot', `Hello ${nm}! I can answer questions about office hours, requirements and appointments. Type "speak to a human" any time to reach staff.`);
  res.status(201).json({ id: ins.insertId, token });
});

r.get('/sessions/:id/messages', async (req, res) => {
  const s = await visitorSession(req);
  const [rows] = await pool.query('SELECT id,sender_type,message,created_at FROM chat_messages WHERE session_id=? AND id>? ORDER BY id LIMIT 200',
    [s.id, afterId(req.query.after)]);
  res.json({ status: s.status, messages: rows });
});

r.post('/sessions/:id/messages', async (req, res) => {
  const s = await visitorSession(req);
  const msg = text(body(req).message, 'Message', { max: 1000, multiline: true });
  if (s.status === 'closed') throw new HttpError(409, 'This chat is closed. Start a new one.');
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM chat_messages WHERE session_id=?', [s.id]);
  if (n >= MAX_MESSAGES) throw new HttpError(429, 'This chat is full. Please start a new one.');
  await addMsg(s.id, 'visitor', msg);
  if (s.status === 'bot') scheduleBotReply(s.id);
  res.status(201).json({ ok: true });
});

/* ---------- Staff ---------- */
r.get('/staff/sessions', requireAuth('admin', 'employee'), async (req, res) => {
  const admin = req.user.role === 'admin';
  const [rows] = await pool.query(
    `SELECT s.id,s.visitor_name,s.visitor_email,s.status,s.assigned_employee_id,s.created_at,u.name assigned_name,
       (SELECT message FROM chat_messages m WHERE m.session_id=s.id ORDER BY m.id DESC LIMIT 1) last_message
     FROM chat_sessions s LEFT JOIN users u ON u.id=s.assigned_employee_id
     WHERE s.status<>'closed' ${admin ? '' : 'AND s.assigned_employee_id=?'} ORDER BY s.status='waiting_handoff' DESC, s.id DESC LIMIT 100`,
    admin ? [] : [req.user.id]);
  res.json(rows);
});

async function staffSession(req) {
  const [[s]] = await pool.query('SELECT * FROM chat_sessions WHERE id=?', [id(req.params.id, 'chat')]);
  if (!s) throw new HttpError(404, 'Chat not found');
  if (req.user.role === 'employee' && s.assigned_employee_id !== req.user.id) throw new HttpError(403, 'This chat is not assigned to you');
  return s;
}

r.get('/staff/sessions/:id/messages', requireAuth('admin', 'employee'), async (req, res) => {
  const s = await staffSession(req);
  const [rows] = await pool.query('SELECT id,sender_type,message,created_at FROM chat_messages WHERE session_id=? AND id>? ORDER BY id LIMIT 200',
    [s.id, afterId(req.query.after)]);
  res.json({ status: s.status, messages: rows });
});

r.post('/staff/sessions/:id/messages', requireAuth('admin', 'employee'), async (req, res) => {
  const s = await staffSession(req);
  const msg = text(body(req).message, 'Message', { max: 1000, multiline: true });
  if (s.status === 'closed') throw new HttpError(409, 'This chat is closed');
  await addMsg(s.id, 'employee', msg);
  res.status(201).json({ ok: true });
});

r.post('/staff/sessions/:id/assign', requireAuth('admin'), async (req, res) => {
  const sid = id(req.params.id, 'chat');
  const empId = id(body(req).employee_id, 'employee');
  const [[emp]] = await pool.query("SELECT id,name FROM users WHERE id=? AND role='employee'", [empId]);
  if (!emp) throw new HttpError(404, 'Employee not found');
  const [[s]] = await pool.query('SELECT status FROM chat_sessions WHERE id=?', [sid]);
  if (!s) throw new HttpError(404, 'Chat not found');
  if (s.status === 'closed') throw new HttpError(409, 'This chat is closed');
  await pool.query("UPDATE chat_sessions SET assigned_employee_id=?, status='assigned' WHERE id=?", [emp.id, sid]);
  await addMsg(sid, 'bot', `${emp.name} from the Civil Registry Office has joined the chat.`);
  log(req.user.name, `Assigned chat #${sid} to ${emp.name}`);
  res.json({ ok: true });
});

r.post('/staff/sessions/:id/close', requireAuth('admin', 'employee'), async (req, res) => {
  const s = await staffSession(req);
  await pool.query("UPDATE chat_sessions SET status='closed' WHERE id=?", [s.id]);
  await addMsg(s.id, 'bot', 'This chat has ended. Thank you for contacting the Civil Registry Office.');
  log(req.user.name, `Closed chat #${s.id}`);
  res.json({ ok: true });
});

export default r;
