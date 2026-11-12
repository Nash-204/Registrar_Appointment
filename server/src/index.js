import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import auth from './routes/auth.js';
import appointments from './routes/appointments.js';
import employees from './routes/employees.js';
import chat from './routes/chat.js';
import stats from './routes/stats.js';
import services from './routes/services.js';
import settings from './routes/settings.js';
import workload from './routes/workload.js';
import walkins from './routes/walkins.js';
import track from './routes/track.js';
import verify from './routes/verify.js';
import chatbotAdmin from './routes/chatbot.js';
import { warmUp } from './knowledge.js';
import { HttpError } from './validate.js';

const prod = process.env.NODE_ENV === 'production';

/* ---------- Refuse to start with an unsafe configuration ---------- */
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /change-me/i.test(process.env.JWT_SECRET)) {
  console.error('JWT_SECRET in server/.env must be a random string of at least 32 characters.');
  console.error('Generate one with:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}
if (prod) {
  const problems = [];
  if (!process.env.SMTP_HOST) problems.push('SMTP_HOST is required: email verification codes and booking confirmations must be delivered.');
  if (!process.env.DB_PASSWORD) problems.push('DB_PASSWORD is empty. Use a dedicated MySQL user with a strong password, not root.');
  if (/localhost|127\.0\.0\.1/.test(process.env.CLIENT_ORIGIN || 'localhost')) problems.push('CLIENT_ORIGIN must be your public website address, for example https://civilregistry.example.gov.ph');
  if (problems.length) { problems.forEach((p) => console.error('Config problem: ' + p)); process.exit(1); }
}

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1); // behind nginx/a load balancer, so rate limits see the real visitor IP
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
// Knowledge files can be large, so the chatbot admin routes get a bigger body limit; everything else stays small.
const smallJson = express.json({ limit: '20kb' });
app.use((req, res, next) => (req.path.startsWith('/api/chatbot') ? next() : smallJson(req, res, next)));

if (prod) { // one line per request: method, path, status, time. Never bodies, queries or tokens.
  app.use((req, res, next) => {
    const t = Date.now();
    res.on('finish', () => { if (req.path !== '/api/health') console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${Date.now() - t}ms`); });
    next();
  });
}

/* ---------- Rate limits ---------- */
const limiter = (windowMin, max, msg, skip) =>
  rateLimit({ windowMs: windowMin * 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { error: msg }, skip });

// Staff dashboards poll often from one office IP, so requests with a valid login token skip only the general limit.
const hasValidToken = (req) => {
  const h = req.headers.authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return false;
  try { jwt.verify(h.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] }); return true; } catch { return false; }
};

app.use('/api', limiter(15, 1500, 'Too many requests. Please slow down and try again shortly.', hasValidToken));
app.use('/api/auth/login', limiter(15, 10, 'Too many sign-in attempts. Try again in 15 minutes.'));
app.post('/api/verify/request', limiter(15, 8, 'Too many code requests. Please wait a few minutes and try again.'));
app.post('/api/verify/confirm', limiter(15, 30, 'Too many attempts. Please wait a few minutes and try again.'));
app.post('/api/appointments', limiter(60, 10, 'Too many bookings from this connection. Try again later.'));
app.use('/api/track', limiter(15, 15, 'Too many lookups. Please wait a few minutes and try again.'));
app.post('/api/chat/sessions', limiter(60, 20, 'Too many chats started. Try again later.'));
app.post('/api/chat/sessions/:id/messages', limiter(1, 30, 'You are sending messages too fast.'));

// Express 4 does not catch async errors, so wrap every route handler
const wrap = (router) => {
  router.stack.forEach((l) => l.route?.stack.forEach((h) => {
    const fn = h.handle;
    if (fn.length < 4) h.handle = (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  }));
  return router;
};

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
});
app.use('/api/auth', wrap(auth));
app.use('/api/verify', wrap(verify));
app.use('/api/appointments', wrap(appointments));
app.use('/api/employees', wrap(employees));
app.use('/api/chat', wrap(chat));
app.use('/api/stats', wrap(stats));
app.use('/api/services', wrap(services));
app.use('/api/settings', wrap(settings));
app.use('/api/workload', wrap(workload));
app.use('/api/walkins', wrap(walkins));
app.use('/api/track', wrap(track));
app.use('/api/chatbot', express.json({ limit: '400kb' }), wrap(chatbotAdmin));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

/* ---------- Serve the built website (npm run build in /client) from this same server ---------- */
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist, { maxAge: prod ? '7d' : 0, index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html'))); // single-page app: every other address loads the site
}

app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
  console.error(err); // details stay in the server log, never sent to the browser
  res.status(500).json({ error: 'Something went wrong on our side' });
});

process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));

const port = process.env.PORT || 4000;
const server = app.listen(port, () => { console.log(`API on :${port}${prod ? ' (production)' : ''}`); warmUp(); }); // build the chatbot's search index now, not on the first question
const shutdown = () => { server.close(() => pool.end().finally(() => process.exit(0))); setTimeout(() => process.exit(1), 10000).unref(); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
