// Database side of scheduling: loads a day, takes a per-date lock, and books/assigns inside a transaction.
import { pool } from './db.js';
import { getSettings } from './settings.js';
import { HttpError } from './validate.js';
import { weekdayOf, toMin, hhmm, isHHMM } from './time.js';
import { consumeVerification } from './verification.js';
import {
  buildDay, canFit, computeOnlineSlots, resolveHourStart, dateError, metrics, pickEmployee, earliestStart, newReference,
  officeWindow, bookingWindow, nowCtx,
} from './scheduleLogic.js';

export async function loadDay(db, date) {
  const wd = weekdayOf(date);
  const [employees] = await db.query("SELECT id,name FROM users WHERE role='employee' ORDER BY id");
  const [schedules] = await db.query(
    `SELECT employee_id, is_working, TIME_FORMAT(start_time,'%H:%i') start_time, TIME_FORMAT(end_time,'%H:%i') end_time,
            TIME_FORMAT(lunch_start,'%H:%i') lunch_start, TIME_FORMAT(lunch_end,'%H:%i') lunch_end
     FROM employee_schedules WHERE weekday=?`, [wd]);
  const [quals] = await db.query('SELECT employee_id, service_id FROM employee_services');
  const [blockedDates] = await db.query('SELECT employee_id FROM blocked_dates WHERE date=?', [date]);
  const [blockedSlots] = await db.query("SELECT employee_id, TIME_FORMAT(time_slot,'%H:%i') t FROM blocked_slots WHERE date=?", [date]);
  const [appts] = await db.query(
    `SELECT id, handled_by, source, status, duration_minutes dur, buffer_minutes buf, TIME_FORMAT(appointment_time,'%H:%i') t
     FROM appointments WHERE appointment_date=? AND status<>'cancelled'`, [date]);
  return buildDay({ date, employees, schedules, quals, blockedDates, blockedSlots, appts });
}

export async function loadService(db, serviceId) {
  const [[s]] = await db.query('SELECT id, purpose, duration_minutes, is_active FROM services WHERE id=?', [serviceId]);
  if (!s || !s.is_active) throw new HttpError(400, 'That service is not available for booking');
  return s;
}

// One lock per calendar date serializes every booking, walk-in and reassignment for that day (works across several Node processes).
// The lock is taken BEFORE the transaction starts so the transaction's snapshot always includes earlier bookings.
export async function withDateLock(date, fn) {
  const conn = await pool.getConnection();
  const name = `registry:${date}`;
  let locked = false;
  try {
    const [[row]] = await conn.query('SELECT GET_LOCK(?, 10) AS got', [name]);
    if (Number(row.got) !== 1) throw new HttpError(503, 'The booking system is busy. Please try again in a moment.');
    locked = true;
    await conn.beginTransaction();
    try { const out = await fn(conn); await conn.commit(); return out; }
    catch (e) { await conn.rollback(); throw e; }
  } finally {
    if (locked) await conn.query('SELECT RELEASE_LOCK(?)', [name]).catch(() => {});
    conn.release();
  }
}

async function insertAppointment(conn, a) {
  for (let i = 0; i < 5; i++) {
    const ref = newReference();
    try {
      const [r] = await conn.query(
        `INSERT INTO appointments (reference_code, purpose, custom_purpose, service_id, source, full_name, email, phone,
           appointment_date, appointment_time, end_time, duration_minutes, buffer_minutes, arrival_time, status, handled_by, checklist_snapshot)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ref, a.purpose, a.custom, a.service_id, a.source, a.full_name, a.email, a.phone, a.date, a.time, a.end, a.dur, a.buf,
          a.arrival || null, 'pending', a.employee_id, a.snapshot ? JSON.stringify(a.snapshot) : null]);
      return { id: r.insertId, reference_code: ref };
    } catch (e) { if (e.code !== 'ER_DUP_ENTRY') throw e; }
  }
  throw new Error('Could not generate a unique reference code');
}

export async function requirementsFor(db, serviceId) {
  const [rows] = await db.query(
    `SELECT label, detail, kind FROM service_requirements WHERE service_id=? AND is_active=1 ORDER BY kind='conditional', sort_order, id`, [serviceId]);
  return rows;
}

const REASONS = {
  closed: 'The office is closed that day.',
  limit: 'Online appointments for that day are fully booked.',
  capacity: 'Online appointments for that day are fully booked.',
  full: 'No slots are left in that hour. Please pick another.',
  no_staff: 'No staff member is available for this service that day.',
};

export async function bookOnline({ service, custom, full_name, email, phone, date, time, hour, verificationToken, skipVerification = false }) {
  return withDateLock(date, async (conn) => {
    const st = await getSettings(conn);
    const ctx = nowCtx();
    const err = dateError(date, st, ctx);
    if (err) throw new HttpError(400, err);
    const dur = service.duration_minutes, buf = st.buffer_minutes;
    const day = await loadDay(conn, date);
    // Availability is re-checked here under the lock; never trust what the screen showed earlier.
    if (hour) {
      const r = resolveHourStart(day, st, { id: service.id, dur }, ctx, hour);
      if (r.start == null) throw new HttpError(409, (r.reason && REASONS[r.reason]) || 'No slots are left in that hour. Please pick another.');
      time = hhmm(r.start); // the exact start time is assigned inside the hour the client chose
    } else {
      const slots = computeOnlineSlots(day, st, { id: service.id, dur }, ctx);
      if (!isHHMM(time) || !slots.times.includes(time))
        throw new HttpError(409, (slots.reason && REASONS[slots.reason]) || 'That time is no longer available. Please pick another.');
    }
    const emp = pickEmployee(day, service.id, bookingWindow(st), toMin(time), dur, buf);
    if (!emp) throw new HttpError(409, 'That time was just taken. Please pick another.');
    const [[dupe]] = await conn.query("SELECT id FROM appointments WHERE email=? AND appointment_date=? AND status<>'cancelled' LIMIT 1", [email, date]);
    if (dupe) throw new HttpError(409, 'This email already has an appointment on that day.');
    // The email must have been verified with a code. The token is used up inside this transaction, so a failed booking does not burn it.
    if (!skipVerification) await consumeVerification(conn, email, verificationToken);
    const checklist = await requirementsFor(conn, service.id);
    const snapshot = { taken_at: new Date().toISOString(), acknowledged: true, notice: st.checklist_notice, requirements: checklist };
    const end = hhmm(toMin(time) + dur);
    const { reference_code } = await insertAppointment(conn, {
      purpose: service.purpose, custom, service_id: service.id, source: 'online', full_name, email, phone,
      date, time, end, dur, buf, employee_id: emp.id, snapshot,
    });
    return { reference_code, purpose: service.purpose, custom_purpose: custom, full_name, email, phone,
      appointment_date: date, appointment_time: time, end_time: end, duration_minutes: dur, checklist, notice: st.checklist_notice };
  });
}

export async function registerWalkin({ service, custom, full_name, phone, email, arrival, employeeId }) {
  const ctx = nowCtx();
  const date = ctx.today;
  return withDateLock(date, async (conn) => {
    const st = await getSettings(conn);
    const day = await loadDay(conn, date);
    if (day.closed) throw new HttpError(409, 'The office is closed today.');
    const win = officeWindow(st);
    const dur = service.duration_minutes, buf = st.buffer_minutes;
    const m = metrics(day, st, ctx);
    if (m.onlineMin + m.walkMin + dur + buf > m.capacity) throw new HttpError(409, 'No capacity is left today for this service.');
    const arrivalMin = arrival ? toMin(arrival) : ctx.nowMin;
    if (arrivalMin < win.start || arrivalMin >= win.end) throw new HttpError(400, 'Arrival time must be inside office hours.');
    const notBefore = Math.max(arrivalMin, win.start);
    let candidates;
    if (employeeId) {
      const emp = day.emps.find((e) => e.id === employeeId);
      if (!emp) throw new HttpError(404, 'Employee not found');
      if (!emp.quals.has(service.id)) throw new HttpError(422, `${emp.name} is not qualified to handle this service.`);
      candidates = [emp];
    } else {
      candidates = day.emps.filter((e) => e.quals.has(service.id));
      if (!candidates.length) throw new HttpError(409, 'No staff member is qualified for this service.');
    }
    let best = null;
    for (const e of candidates) {
      const t = earliestStart(e, day.closed, win, dur, buf, notBefore, st.slot_step_minutes);
      if (t != null && (!best || t < best.t || (t === best.t && e.appts.length < best.e.appts.length))) best = { e, t };
    }
    if (!best) throw new HttpError(409, employeeId ? 'That employee has no free time left today.' : 'No employee has free time left today for this service.');
    const time = hhmm(best.t), end = hhmm(best.t + dur);
    const { reference_code } = await insertAppointment(conn, {
      purpose: service.purpose, custom, service_id: service.id, source: 'walk_in', full_name, email, phone,
      date, time, end, dur, buf, arrival: hhmm(arrivalMin), employee_id: best.e.id, snapshot: null,
    });
    return { reference_code, purpose: service.purpose, full_name, appointment_date: date, appointment_time: time, end_time: end,
      duration_minutes: dur, assigned_to: best.e.name, assigned_employee_id: best.e.id, arrival_time: hhmm(arrivalMin) };
  });
}

// Admin reassignment: same qualification and overlap rules as booking.
export async function reassignAppointment(appt, employeeId) {
  const date = appt.appointment_date;
  return withDateLock(date, async (conn) => {
    const [[fresh]] = await conn.query(
      `SELECT id, service_id, duration_minutes dur, buffer_minutes buf, TIME_FORMAT(appointment_time,'%H:%i') t, status FROM appointments WHERE id=?`, [appt.id]);
    if (!fresh) throw new HttpError(404, 'Appointment not found');
    const st = await getSettings(conn);
    const day = await loadDay(conn, date);
    const emp = day.emps.find((e) => e.id === employeeId);
    if (!emp) throw new HttpError(404, 'Employee not found');
    if (fresh.service_id && !emp.quals.has(fresh.service_id)) throw new HttpError(422, `${emp.name} is not qualified to handle this service.`);
    if (fresh.status !== 'cancelled' && !canFit(emp, day.closed, officeWindow(st), toMin(fresh.t), fresh.dur, fresh.buf, fresh.id))
      throw new HttpError(409, `${emp.name} is not free at that time (schedule, lunch, block or another appointment).`);
    await conn.query('UPDATE appointments SET handled_by=? WHERE id=?', [employeeId, fresh.id]);
    return emp;
  });
}
