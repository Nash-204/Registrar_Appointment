import { Router } from 'express';
import { pool, log } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendBookingEmail } from '../mailer.js';
import { getSettings } from '../settings.js';
import { HttpError, body, text, name, email, phone, id, oneOf, dateStr, q, bool } from '../validate.js';
import { computeHourlySlots, dateError, nowCtx } from '../scheduleLogic.js';
import { loadDay, loadService, bookOnline, reassignAppointment } from '../scheduling.js';
import { nowSql } from '../time.js';

const r = Router();
export const STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

/* ---------- Public ---------- */
r.get('/slots', async (req, res) => {
  const date = dateStr(q(req.query.date, 'date'));
  const svc = await loadService(pool, id(q(req.query.service_id, 'service'), 'service'));
  const st = await getSettings();
  const ctx = nowCtx();
  const err = dateError(date, st, ctx);
  if (err) throw new HttpError(400, err);
  const out = computeHourlySlots(await loadDay(pool, date), st, { id: svc.id, dur: svc.duration_minutes }, ctx);
  res.json({ date, duration_minutes: svc.duration_minutes, ...out });
});

r.post('/', async (req, res) => {
  const b = body(req);
  const svc = await loadService(pool, id(b.service_id, 'service'));
  const custom = svc.purpose === 'Others' ? text(b.custom_purpose, 'Your purpose', { min: 3, max: 255 }) : null;
  const full_name = name(b.full_name, 'Full name');
  const em = email(b.email);
  const ph = phone(b.phone);
  const date = dateStr(b.appointment_date, 'Date');
  const hour = typeof b.appointment_hour === 'string' ? b.appointment_hour : null;
  if (!hour || !/^([01]\d|2[0-3]):00$/.test(hour)) throw new HttpError(400, 'Pick an hour for your appointment.');
  if (!bool(b.acknowledged ?? false, 'Checklist confirmation')) throw new HttpError(400, 'Please confirm you have read the document checklist.');
  const appt = await bookOnline({ service: svc, custom, full_name, email: em, phone: ph, date, hour, verificationToken: typeof b.verification_token === 'string' ? b.verification_token : '' });
  let emailed = true;
  try { await sendBookingEmail(appt); } catch (e) { emailed = false; console.error('Email failed:', e.message); }
  log('Public', `Booked ${appt.reference_code}`);
  res.status(201).json({ ...appt, emailed });
});

/* ---------- Staff ---------- */
r.get('/', requireAuth('admin', 'employee'), async (req, res) => {
  const status = q(req.query.status, 'status');
  const date = q(req.query.date, 'date');
  const source = q(req.query.source, 'source');
  const unassigned = q(req.query.unassigned, 'filter');
  const scope = q(req.query.scope, 'scope');
  const sort = oneOf(q(req.query.sort, 'sort') || 'latest', ['latest', 'earliest', 'booked'], 'sort');
  const all = req.user.role === 'admin' || (req.user.front_desk && scope === 'all'); // front desk employees see everyone's on the desk tabs, only their own on My appointments
  const where = []; const args = [];
  if (status) { where.push('a.status=?'); args.push(oneOf(status, STATUSES, 'status')); }
  if (date) { where.push('a.appointment_date=?'); args.push(dateStr(date)); }
  if (source) { where.push('a.source=?'); args.push(oneOf(source, ['online', 'walk_in'], 'source')); }
  if (!all) { where.push('a.handled_by=?'); args.push(req.user.id); } // otherwise employees only see their own
  else if (unassigned === '1') where.push("a.handled_by IS NULL AND a.status<>'cancelled'");
  const order = {
    latest: 'a.appointment_date DESC, a.appointment_time DESC, a.id DESC',   // latest appointment on top
    earliest: 'a.appointment_date ASC, a.appointment_time ASC, a.id ASC',
    booked: 'a.created_at DESC, a.id DESC',                                   // most recently booked on top
  }[sort];
  const [rows] = await pool.query(
    `SELECT a.id, a.reference_code, a.purpose, a.custom_purpose, a.full_name, a.email, a.phone, a.appointment_date, a.status,
            a.source, a.handled_by, a.duration_minutes, TIME_FORMAT(a.appointment_time,'%H:%i') appointment_time,
            TIME_FORMAT(a.end_time,'%H:%i') end_time, u.name handled_by_name
     FROM appointments a LEFT JOIN users u ON u.id=a.handled_by
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT 500`, args);
  res.json(rows);
});

r.patch('/:id', requireAuth('admin', 'employee'), async (req, res) => {
  const apptId = id(req.params.id, 'appointment');
  const b = body(req);
  const hasStatus = b.status !== undefined;
  const hasAssign = b.assign_to !== undefined;
  if (!hasStatus && !hasAssign) throw new HttpError(400, 'Nothing to update');
  const status = hasStatus ? oneOf(b.status, STATUSES, 'status') : null;
  const assignTo = hasAssign && b.assign_to !== null && b.assign_to !== '' ? id(b.assign_to, 'employee') : null;

  const [[a]] = await pool.query('SELECT id, reference_code, appointment_date FROM appointments WHERE id=?', [apptId]);
  if (!a) throw new HttpError(404, 'Appointment not found');
  const [[own]] = await pool.query('SELECT handled_by FROM appointments WHERE id=?', [apptId]);
  if (req.user.role === 'employee' && !req.user.front_desk && own.handled_by !== req.user.id) throw new HttpError(403, 'This appointment is not assigned to you');

  if (hasAssign) {
    if (req.user.role !== 'admin' && !req.user.front_desk) throw new HttpError(403, 'Only the admin or front desk can assign appointments');
    if (assignTo === null) {
      await pool.query('UPDATE appointments SET handled_by=NULL WHERE id=?', [a.id]);
      log(req.user.name, `Unassigned ${a.reference_code}`);
    } else {
      const emp = await reassignAppointment(a, assignTo);
      log(req.user.name, `Assigned ${a.reference_code} to ${emp.name}`);
    }
  }
  if (hasStatus) {
    const sets = ['status=?']; const args = [status];
    const stamp = nowSql(); // office time, so elapsed-time estimates match the clock staff see
    if (status === 'in_progress') { sets.push('started_at=COALESCE(started_at, ?)'); args.push(stamp); }
    if (status === 'completed') { sets.push('started_at=COALESCE(started_at, ?)', 'completed_at=?'); args.push(stamp, stamp); }
    if (['pending', 'confirmed', 'cancelled'].includes(status)) sets.push('completed_at=NULL');
    await pool.query(`UPDATE appointments SET ${sets.join(', ')} WHERE id=?`, [...args, a.id]);
    log(req.user.name, `Set ${a.reference_code} to ${status}`);
  }
  res.json({ ok: true });
});

export default r;
