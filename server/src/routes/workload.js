import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getSettings } from '../settings.js';
import { HttpError, id, dateStr, q } from '../validate.js';
import { toMin } from '../time.js';
import { employeeSummary, officeWindow, metrics, nowCtx, serviceCapacity } from '../scheduleLogic.js';
import { loadDay } from '../scheduling.js';

const r = Router();

async function dayRows(date) {
  const [rows] = await pool.query(
    `SELECT a.id, a.reference_code, a.purpose, a.custom_purpose, a.full_name, a.phone, a.source, a.status, a.handled_by,
            a.duration_minutes dur, a.buffer_minutes buf, TIME_FORMAT(a.appointment_time,'%H:%i') t, TIME_FORMAT(a.end_time,'%H:%i') et,
            TIME_FORMAT(a.started_at,'%H:%i') started
     FROM appointments a WHERE a.appointment_date=? ORDER BY a.appointment_time`, [date]);
  return rows.map((x) => ({ ...x, started_min: x.started ? toMin(x.started) : null }));
}

// Employees: their own workload only. Admin: everyone, or one employee with the full schedule.
r.get('/', requireAuth('admin', 'employee'), async (req, res) => {
  const st = await getSettings();
  const ctx = nowCtx();
  const date = q(req.query.date, 'date') ? dateStr(q(req.query.date, 'date')) : ctx.today;
  let empId = q(req.query.employee_id, 'employee') ? id(q(req.query.employee_id, 'employee'), 'employee') : null;
  const all = req.user.role === 'admin' || req.user.front_desk; // admin and front desk see every employee
  if (!all) {
    if (empId !== null && empId !== req.user.id) throw new HttpError(403, 'You can only view your own workload');
    empId = req.user.id;
  }
  const day = await loadDay(pool, date);
  const rows = await dayRows(date);
  const win = officeWindow(st);
  const list = day.emps.filter((e) => (empId ? e.id === empId : true));
  if (empId && !list.length) throw new HttpError(404, 'Employee not found');
  const employees = list.map((e) => {
    const mine = rows.filter((x) => x.handled_by === e.id);
    const out = { id: e.id, name: e.name, ...employeeSummary(e, day.closed, win, mine, st.buffer_minutes, ctx, date) };
    if (empId) {
      out.schedule = mine.map((x) => ({
        id: x.id, reference_code: x.reference_code, time: x.t, end: x.et, duration_minutes: x.dur, status: x.status, source: x.source,
        purpose: x.purpose, custom_purpose: x.custom_purpose, full_name: x.full_name, phone: x.phone,
      }));
    }
    return out;
  });
  const out = { date, estimate: true, closed: day.closed, buffer_minutes: st.buffer_minutes, employees };
  if (all && !empId)
    out.unassigned = rows.filter((x) => x.handled_by == null && x.status !== 'cancelled').length;
  res.json(out);
});

// Admin: office-wide capacity for one date.
r.get('/capacity', requireAuth('admin', 'desk'), async (req, res) => {
  const st = await getSettings();
  const ctx = nowCtx();
  const date = q(req.query.date, 'date') ? dateStr(q(req.query.date, 'date')) : ctx.today;
  const day = await loadDay(pool, date);
  const m = metrics(day, st, ctx);
  res.json({
    date, closed: day.closed,
    capacity_minutes: m.capacity,
    reserve_minutes: m.reserve, reserve_held_minutes: m.reserveHeld, released: m.released,
    online: {
      count: m.onlineCount, minutes: m.onlineMin, limit: st.daily_online_limit > 0 ? st.daily_online_limit : null, // null = automatic
      remaining_by_limit: st.daily_online_limit > 0 ? Math.max(st.daily_online_limit - m.onlineCount, 0) : null,
      allowed_minutes: m.onlineAllowed, remaining_minutes: Math.max(m.onlineAllowed - m.onlineMin, 0),
    },
    walkin: { count: m.walkCount, minutes: m.walkMin, enabled: st.walkin_enabled, reserve_percent: st.walkin_reserve_percent, release: st.walkin_release, release_time: st.walkin_release_time },
    unused_reserved_minutes: m.unusedReserved,
    remaining_minutes: m.remaining,
  });
});

// Admin: how many clients each service, each employee and the office can handle, from who is assigned to what.
r.get('/service-capacity', requireAuth('admin', 'desk'), async (req, res) => {
  const st = await getSettings();
  const ctx = nowCtx();
  const date = q(req.query.date, 'date') ? dateStr(q(req.query.date, 'date')) : ctx.today;
  const day = await loadDay(pool, date);
  const [svc] = await pool.query('SELECT id, purpose, duration_minutes dur FROM services WHERE is_active=1 ORDER BY sort_order, id');
  const cap = serviceCapacity(day, st, svc);
  const [counts] = await pool.query(
    "SELECT service_id, COUNT(*) n FROM appointments WHERE appointment_date=? AND status<>'cancelled' GROUP BY service_id", [date]);
  const booked = (id) => Number(counts.find((c) => c.service_id === id)?.n || 0);
  const pct = st.walkin_enabled ? st.walkin_reserve_percent : 0;
  const walkin = Math.ceil((cap.total_clients * pct) / 100);
  res.json({
    date, closed: day.closed,
    services: cap.services.map((s) => ({ ...s, booked: booked(s.id), left: Math.max(s.max_clients - booked(s.id), 0) })),
    employees: cap.employees,
    total_clients: cap.total_clients, walkin_reserve_clients: walkin, online_clients: cap.total_clients - walkin,
    staff_without_services: cap.employees.filter((e) => !e.service_ids.length).map((e) => e.name),
  });
});

export default r;
