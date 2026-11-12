import { Router } from 'express';
import { pool } from '../db.js';
import { HttpError, body, text } from '../validate.js';

const r = Router();
const NOT_FOUND = 'We could not find an appointment with that reference code. Check the code in your confirmation email and try again.';

// POST (not GET) so the code never appears in URLs or access logs. Only non-personal fields are returned.
r.post('/', async (req, res) => {
  const raw = text(body(req).reference_code, 'Reference code', { min: 6, max: 30 });
  const code = raw.toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9-]{6,30}$/.test(code)) throw new HttpError(404, NOT_FOUND);
  const [[a]] = await pool.query(
    `SELECT reference_code, purpose, custom_purpose, appointment_date, status, source, duration_minutes,
            TIME_FORMAT(appointment_time,'%H:%i') appointment_time, TIME_FORMAT(end_time,'%H:%i') end_time, checklist_snapshot
     FROM appointments WHERE reference_code=?`, [code]);
  if (!a) throw new HttpError(404, NOT_FOUND);
  let snap = a.checklist_snapshot;
  if (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch { snap = null; } }
  res.json({
    reference_code: a.reference_code,
    purpose: a.purpose,
    custom_purpose: a.custom_purpose,
    appointment_date: a.appointment_date,
    appointment_time: a.appointment_time,
    duration_minutes: a.duration_minutes,
    status: a.status,
    checklist: snap?.requirements || [],
    notice: snap?.notice || null,
  });
});

export default r;
