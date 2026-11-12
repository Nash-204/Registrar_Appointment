import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, log, sqlToday } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, body, name, email, password, id, text, dateStr, oneOf, bool, timeStr } from '../validate.js';
import { toMin, addDays, weekdayOf } from '../time.js';
import { nowCtx, blockHourError } from '../scheduleLogic.js';

const r = Router();
export const BLOCK_HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

function futureWeekday(date, label = 'Date') {
  const { today } = nowCtx();
  const wd = weekdayOf(date);
  if (wd === 0 || wd === 6) throw new HttpError(400, `${label} must be a weekday`);
  if (date < today) throw new HttpError(400, `${label} cannot be in the past`);
  if (date > addDays(today, 365)) throw new HttpError(400, `${label} is too far ahead`);
  return date;
}

/* ---------- Employee list (admin) ---------- */
r.get('/', requireAuth('admin'), async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id,u.name,u.email,u.created_at,u.is_front_desk,
       (SELECT COUNT(*) FROM appointments a WHERE a.handled_by=u.id AND a.status NOT IN ('cancelled','completed') AND a.appointment_date>=${sqlToday()}) open_appointments,
       (SELECT COUNT(*) FROM employee_services es WHERE es.employee_id=u.id) service_count
     FROM users u WHERE u.role='employee' ORDER BY u.name`);
  const [qs] = await pool.query('SELECT es.employee_id, s.id, s.purpose FROM employee_services es JOIN services s ON s.id=es.service_id ORDER BY s.sort_order, s.id');
  res.json(rows.map((r0) => ({ ...r0, services: qs.filter((x) => x.employee_id === r0.id).map((x) => ({ id: x.id, purpose: x.purpose })) })));
});

// Names only, so front desk can assign appointments and walk-ins without seeing accounts.
r.get('/options', requireAuth('admin', 'desk'), async (_req, res) => {
  const [rows] = await pool.query("SELECT id, name FROM users WHERE role='employee' ORDER BY name");
  res.json(rows);
});

r.put('/:id/front-desk', requireAuth('admin'), async (req, res) => {
  const eid = id(req.params.id, 'employee');
  const on = bool(body(req).is_front_desk, 'Front desk');
  const [r1] = await pool.query("UPDATE users SET is_front_desk=? WHERE id=? AND role='employee'", [on ? 1 : 0, eid]);
  if (!r1.affectedRows) throw new HttpError(404, 'Employee not found');
  log(req.user.name, `${on ? 'Made' : 'Removed'} employee #${eid} ${on ? 'front desk' : 'from front desk'}`);
  res.json({ ok: true });
});

r.post('/', requireAuth('admin'), async (req, res) => {
  const b = body(req);
  const frontDesk = b.is_front_desk === undefined ? false : bool(b.is_front_desk, 'Front desk');
  const n = name(b.name, 'Name');
  const em = email(b.email);
  const pw = password(b.password);
  // Services the new employee will handle. Nothing is assumed: an employee with no services receives no clients.
  const svcIds = b.service_ids === undefined ? [] : [...new Set((Array.isArray(b.service_ids) ? b.service_ids : (() => { throw new HttpError(400, 'Send a list of services'); })()).map((x) => id(x, 'service')))];
  if (svcIds.length > 100) throw new HttpError(400, 'Too many services');
  if (svcIds.length) {
    const [found] = await pool.query('SELECT id FROM services WHERE id IN (?)', [svcIds]);
    if (found.length !== svcIds.length) throw new HttpError(400, 'One of the services does not exist');
  }
  const hash = await bcrypt.hash(pw, 10);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ins] = await conn.query("INSERT INTO users (name,email,password_hash,role,is_front_desk) VALUES (?,?,?,'employee',?)", [n, em, hash, frontDesk ? 1 : 0]);
    await conn.query('INSERT INTO employee_schedules (employee_id, weekday) SELECT ?, d.n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) d', [ins.insertId]);
    for (const sid of svcIds) await conn.query('INSERT INTO employee_services (employee_id, service_id) VALUES (?,?)', [ins.insertId, sid]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That email is already in use');
    throw e;
  } finally { conn.release(); }
  log(req.user.name, `Added employee ${n}`);
  res.status(201).json({ ok: true });
});

/* ---------- Blocked hours (an employee's own) ---------- */
r.get('/blocked', requireAuth('admin', 'employee'), async (req, res) => {
  const admin = req.user.role === 'admin';
  const [rows] = await pool.query(
    `SELECT b.id,b.date,TIME_FORMAT(b.time_slot,'%H:%i') time_slot,b.reason,u.name employee_name
     FROM blocked_slots b JOIN users u ON u.id=b.employee_id
     WHERE b.date>=${sqlToday()} ${admin ? '' : 'AND b.employee_id=?'} ORDER BY b.date,b.time_slot`, admin ? [] : [req.user.id]);
  res.json(rows);
});

r.post('/blocked', requireAuth('employee'), async (req, res) => {
  const b = body(req);
  const date = futureWeekday(dateStr(b.date));
  if (!Array.isArray(b.time_slots) || !b.time_slots.length || b.time_slots.length > BLOCK_HOURS.length) throw new HttpError(400, 'Pick at least one hour');
  const slots = [...new Set(b.time_slots.map((s) => oneOf(s, BLOCK_HOURS, 'hour')))];
  for (const s of slots) { const bad = blockHourError(date, s, nowCtx()); if (bad) throw new HttpError(400, bad); }
  const reason = text(b.reason, 'Reason', { max: 255, optional: true });
  for (const s of slots)
    await pool.query('INSERT IGNORE INTO blocked_slots (employee_id,date,time_slot,reason) VALUES (?,?,?,?)', [req.user.id, date, s, reason]);
  log(req.user.name, `Blocked ${slots.length} slot(s) on ${date}`);
  res.status(201).json({ ok: true });
});

r.delete('/blocked/:id', requireAuth('employee'), async (req, res) => {
  await pool.query('DELETE FROM blocked_slots WHERE id=? AND employee_id=?', [id(req.params.id, 'block'), req.user.id]);
  res.json({ ok: true });
});

/* ---------- Blocked dates: employees block their own day off, the admin can close the whole office ---------- */
r.get('/blocked-dates', requireAuth('admin', 'employee'), async (req, res) => {
  const admin = req.user.role === 'admin';
  const [rows] = await pool.query(
    `SELECT d.id, d.date, d.reason, d.employee_id, u.name employee_name FROM blocked_dates d LEFT JOIN users u ON u.id=d.employee_id
     WHERE d.date>=${sqlToday()} ${admin ? '' : 'AND (d.employee_id=? OR d.employee_id IS NULL)'} ORDER BY d.date`, admin ? [] : [req.user.id]);
  res.json(rows);
});

r.post('/blocked-dates', requireAuth('admin', 'employee'), async (req, res) => {
  const b = body(req);
  const date = futureWeekday(dateStr(b.date));
  const reason = text(b.reason, 'Reason', { max: 255, optional: true });
  let empId = null; // null = whole office
  if (req.user.role === 'employee') empId = req.user.id;
  else if (b.employee_id !== undefined && b.employee_id !== null && b.employee_id !== '') {
    empId = id(b.employee_id, 'employee');
    const [[e]] = await pool.query("SELECT id FROM users WHERE id=? AND role='employee'", [empId]);
    if (!e) throw new HttpError(404, 'Employee not found');
  }
  const [[dupe]] = await pool.query('SELECT id FROM blocked_dates WHERE date=? AND employee_id <=> ?', [date, empId]);
  if (dupe) throw new HttpError(409, 'That date is already blocked');
  await pool.query('INSERT INTO blocked_dates (employee_id,date,reason) VALUES (?,?,?)', [empId, date, reason]);
  log(req.user.name, empId ? `Blocked ${date} for an employee` : `Closed the office on ${date}`);
  res.status(201).json({ ok: true });
});

r.delete('/blocked-dates/:id', requireAuth('admin', 'employee'), async (req, res) => {
  const did = id(req.params.id, 'block');
  if (req.user.role === 'admin') await pool.query('DELETE FROM blocked_dates WHERE id=?', [did]);
  else await pool.query('DELETE FROM blocked_dates WHERE id=? AND employee_id=?', [did, req.user.id]);
  res.json({ ok: true });
});

/* ---------- Schedules and qualifications (admin) ---------- */
r.get('/:id/config', requireAuth('admin'), async (req, res) => {
  const eid = id(req.params.id, 'employee');
  const [[e]] = await pool.query("SELECT id,name FROM users WHERE id=? AND role='employee'", [eid]);
  if (!e) throw new HttpError(404, 'Employee not found');
  const [days] = await pool.query(
    `SELECT weekday, is_working, TIME_FORMAT(start_time,'%H:%i') start_time, TIME_FORMAT(end_time,'%H:%i') end_time,
            TIME_FORMAT(lunch_start,'%H:%i') lunch_start, TIME_FORMAT(lunch_end,'%H:%i') lunch_end
     FROM employee_schedules WHERE employee_id=? ORDER BY weekday`, [eid]);
  const [svc] = await pool.query('SELECT service_id FROM employee_services WHERE employee_id=?', [eid]);
  res.json({ ...e, days, service_ids: svc.map((x) => x.service_id) });
});

r.put('/:id/schedule', requireAuth('admin'), async (req, res) => {
  const eid = id(req.params.id, 'employee');
  const b = body(req);
  if (!Array.isArray(b.days) || !b.days.length || b.days.length > 5) throw new HttpError(400, 'Send the weekday schedule');
  const [[e]] = await pool.query("SELECT id,name FROM users WHERE id=? AND role='employee'", [eid]);
  if (!e) throw new HttpError(404, 'Employee not found');
  const clean = b.days.map((d0) => {
    const d = body({ body: d0 });
    const weekday = Number(d.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 5) throw new HttpError(400, 'Weekday must be Monday to Friday');
    const working = bool(d.is_working, 'Working day');
    const start = timeStr(d.start_time, 'Start time'), end = timeStr(d.end_time, 'End time');
    const hasLunch = d.lunch_start && d.lunch_end;
    if (working && toMin(start) >= toMin(end)) throw new HttpError(400, 'Shift end must be after shift start');
    let ls = null, le = null;
    if (hasLunch) {
      ls = timeStr(d.lunch_start, 'Lunch start'); le = timeStr(d.lunch_end, 'Lunch end');
      if (toMin(ls) >= toMin(le)) throw new HttpError(400, 'Lunch must end after it starts');
      if (working && (toMin(ls) < toMin(start) || toMin(le) > toMin(end))) throw new HttpError(400, 'Lunch must be inside the shift');
    } else if (d.lunch_start || d.lunch_end) throw new HttpError(400, 'Enter both lunch start and lunch end, or leave both empty');
    return [eid, weekday, working ? 1 : 0, start, end, ls, le];
  });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const row of clean)
      await conn.query(
        `INSERT INTO employee_schedules (employee_id, weekday, is_working, start_time, end_time, lunch_start, lunch_end) VALUES (?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE is_working=VALUES(is_working), start_time=VALUES(start_time), end_time=VALUES(end_time),
                                 lunch_start=VALUES(lunch_start), lunch_end=VALUES(lunch_end)`, row);
    await conn.commit();
  } catch (x) { await conn.rollback(); throw x; } finally { conn.release(); }
  log(req.user.name, `Updated the schedule of ${e.name}`);
  res.json({ ok: true });
});

r.put('/:id/services', requireAuth('admin'), async (req, res) => {
  const eid = id(req.params.id, 'employee');
  const b = body(req);
  if (!Array.isArray(b.service_ids) || b.service_ids.length > 100) throw new HttpError(400, 'Send a list of services');
  const ids = [...new Set(b.service_ids.map((x) => id(x, 'service')))];
  const [[e]] = await pool.query("SELECT id,name FROM users WHERE id=? AND role='employee'", [eid]);
  if (!e) throw new HttpError(404, 'Employee not found');
  if (ids.length) {
    const [found] = await pool.query('SELECT id FROM services WHERE id IN (?)', [ids]);
    if (found.length !== ids.length) throw new HttpError(400, 'One of the services does not exist');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM employee_services WHERE employee_id=?', [eid]);
    for (const sid of ids) await conn.query('INSERT INTO employee_services (employee_id, service_id) VALUES (?,?)', [eid, sid]);
    await conn.commit();
  } catch (x) { await conn.rollback(); throw x; } finally { conn.release(); }
  log(req.user.name, `Updated the services ${e.name} can handle`);
  res.json({ ok: true });
});

r.delete('/:id', requireAuth('admin'), async (req, res) => {
  const uid = id(req.params.id, 'employee');
  const [[u]] = await pool.query("SELECT name FROM users WHERE id=? AND role='employee'", [uid]);
  if (!u) throw new HttpError(404, 'Employee not found');
  await pool.query('DELETE FROM users WHERE id=?', [uid]);
  log(req.user.name, `Removed employee ${u.name}`);
  res.json({ ok: true });
});

export default r;
