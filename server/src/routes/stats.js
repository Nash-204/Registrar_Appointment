import { Router } from 'express';
import { pool, sqlToday } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.get('/', requireAuth('admin'), async (_req, res) => {
  const one = async (sql) => (await pool.query(sql))[0][0].n;
  const today = sqlToday();
  const [logs] = await pool.query('SELECT actor,action,created_at FROM activity_logs ORDER BY id DESC LIMIT 25');
  res.json({
    appointmentsToday: await one(`SELECT COUNT(*) n FROM appointments WHERE appointment_date=${today} AND status<>'cancelled'`),
    pending: await one("SELECT COUNT(*) n FROM appointments WHERE status='pending'"),
    upcoming: await one(`SELECT COUNT(*) n FROM appointments WHERE appointment_date>=${today} AND status<>'cancelled'`),
    employees: await one("SELECT COUNT(*) n FROM users WHERE role='employee'"),
    unassigned: await one(`SELECT COUNT(*) n FROM appointments WHERE handled_by IS NULL AND status<>'cancelled' AND appointment_date>=${today}`),
    waitingChats: await one("SELECT COUNT(*) n FROM chat_sessions WHERE status='waiting_handoff'"),
    activeChats: await one("SELECT COUNT(*) n FROM chat_sessions WHERE status IN ('assigned','waiting_handoff')"),
    logs,
  });
});
export default r;
