import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export const signToken = (u) =>
  jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h' });

// Verifies the token AND that the account still exists with the same role,
// so a removed employee is locked out immediately instead of when the token expires.
export const requireAuth = (...roles) => async (req, res, next) => {
  const h = req.headers.authorization;
  const token = typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { return res.status(401).json({ error: 'Session expired. Sign in again.' }); }
  try {
    const [[u]] = await pool.query('SELECT id,name,role,is_front_desk FROM users WHERE id=?', [payload.id]);
    if (!u || u.role !== payload.role) return res.status(401).json({ error: 'Session expired. Sign in again.' });
    const frontDesk = u.role === 'employee' && !!u.is_front_desk;
    // Listing 'desk' lets front desk employees in as well as the roles listed.
    if (roles.length && !roles.includes(u.role) && !(frontDesk && roles.includes('desk'))) return res.status(403).json({ error: 'You do not have access to this' });
    req.user = { id: u.id, name: u.name, role: u.role, front_desk: frontDesk };
    next();
  } catch (e) { next(e); }
};
