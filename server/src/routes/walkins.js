import { Router } from 'express';
import { pool, log } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, body, text, name, email, phone, id, timeStr } from '../validate.js';
import { nowCtx, walkinArrivalError } from '../scheduleLogic.js';
import { getSettings } from '../settings.js';
import { loadService, registerWalkin } from '../scheduling.js';

const r = Router();
const blank = (v) => v === undefined || v === null || v === '';

r.post('/', requireAuth('admin', 'employee'), async (req, res) => {
  const b = body(req);
  const svc = await loadService(pool, id(b.service_id, 'service'));
  const custom = svc.purpose === 'Others' ? text(b.custom_purpose, 'Purpose', { min: 3, max: 255 }) : null;
  const full_name = name(b.full_name, 'Client name');
  const ph = phone(b.phone);
  const em = blank(b.email) ? null : email(b.email);
  const arrival = blank(b.arrival_time) ? null : timeStr(b.arrival_time, 'Arrival time');
  let employeeId = null;
  const all = req.user.role === 'admin' || req.user.front_desk;
  if (!all) {
    if (!blank(b.employee_id) && id(b.employee_id, 'employee') !== req.user.id) throw new HttpError(403, 'You can only register walk-ins for yourself');
    employeeId = req.user.id;
  } else if (!blank(b.employee_id)) employeeId = id(b.employee_id, 'employee'); // admin and front desk may pick anyone, or leave it empty for auto-assign
  const arrivalProblem = walkinArrivalError(arrival, await getSettings(), nowCtx());
  if (arrivalProblem) throw new HttpError(400, arrivalProblem);
  const out = await registerWalkin({ service: svc, custom, full_name, phone: ph, email: em, arrival, employeeId });
  log(req.user.name, `Registered walk-in ${out.reference_code} for ${out.assigned_to}`);
  res.status(201).json(out);
});

r.get('/', requireAuth('admin', 'employee'), async (req, res) => {
  const args = [nowCtx().today]; let own = '';
  if (!(req.user.role === 'admin' || req.user.front_desk)) { own = 'AND a.handled_by=?'; args.push(req.user.id); }
  const [rows] = await pool.query(
    `SELECT a.id, a.reference_code, a.purpose, a.custom_purpose, a.full_name, a.phone, a.status, a.duration_minutes,
            TIME_FORMAT(a.appointment_time,'%H:%i') appointment_time, TIME_FORMAT(a.arrival_time,'%H:%i') arrival_time, u.name handled_by_name
     FROM appointments a LEFT JOIN users u ON u.id=a.handled_by
     WHERE a.source='walk_in' AND a.appointment_date=? ${own} ORDER BY a.id DESC`, args); // newest registration first
  res.json(rows);
});

export default r;
