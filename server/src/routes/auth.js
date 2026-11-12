import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, log } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { body, email, text } from '../validate.js';

const r = Router();
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // keeps timing the same when the email doesn't exist

r.post('/login', async (req, res) => {
  const b = body(req);
  const em = email(b.email);
  const pw = text(b.password, 'Password', { max: 200 });
  const [[u]] = await pool.query('SELECT * FROM users WHERE email=?', [em]);
  const ok = await bcrypt.compare(pw, u ? u.password_hash : DUMMY_HASH);
  if (!u || !ok) return res.status(401).json({ error: 'Email or password is incorrect' });
  log(u.name, 'Signed in');
  res.json({ token: signToken(u), user: { id: u.id, name: u.name, email: u.email, role: u.role, front_desk: u.role === 'employee' && !!u.is_front_desk } });
});

r.get('/me', requireAuth(), (req, res) => res.json({ user: req.user }));

export default r;
