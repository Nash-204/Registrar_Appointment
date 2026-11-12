import { Router } from 'express';
import { pool, log, sqlToday } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, body, text, id, bool, oneOf } from '../validate.js';
import { parseNewService, parseServicePatch, PROTECTED_SERVICE } from '../serviceLogic.js';
import { refreshSoon } from '../knowledge.js';

const r = Router();

const withReqs = async (services, onlyActive) => {
  const [reqs] = await pool.query(
    `SELECT id, service_id, label, detail, kind, is_active, is_sample FROM service_requirements ${onlyActive ? 'WHERE is_active=1' : ''}
     ORDER BY kind='conditional', sort_order, id`);
  return services.map((s) => ({ ...s, requirements: reqs.filter((x) => x.service_id === s.id) }));
};

// Public: active services with their active checklist items (used by the booking wizard and the home page carousel).
r.get('/', async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT id, purpose, grp, icon, summary, note, duration_minutes FROM services WHERE is_active=1 ORDER BY sort_order, id');
  res.json(await withReqs(rows, true));
});

r.get('/admin', requireAuth('admin'), async (_req, res) => {
  const [rows] = await pool.query('SELECT id, purpose, grp, icon, summary, note, duration_minutes, is_active FROM services ORDER BY sort_order, id');
  const [counts] = await pool.query('SELECT service_id, COUNT(*) n FROM employee_services GROUP BY service_id');
  const out = await withReqs(rows, false);
  res.json(out.map((s) => ({ ...s, staff_count: Number(counts.find((c) => c.service_id === s.id)?.n || 0) })));
});

r.patch('/requirements/:rid', requireAuth('admin'), async (req, res) => {
  const rid = id(req.params.rid, 'item');
  const b = body(req);
  const sets = []; const args = [];
  if (b.label !== undefined) { sets.push('label=?'); args.push(text(b.label, 'Document', { max: 300 })); }
  if (b.detail !== undefined) { sets.push('detail=?'); args.push(text(b.detail, 'Detail', { max: 500, optional: true })); }
  if (b.kind !== undefined) { sets.push('kind=?'); args.push(oneOf(b.kind, ['mandatory', 'conditional'], 'type')); }
  if (b.is_active !== undefined) { sets.push('is_active=?'); args.push(bool(b.is_active, 'Active') ? 1 : 0); }
  if (!sets.length) throw new HttpError(400, 'Nothing to update');
  sets.push('is_sample=0'); // an admin has reviewed it
  const [r1] = await pool.query(`UPDATE service_requirements SET ${sets.join(', ')} WHERE id=?`, [...args, rid]);
  if (!r1.affectedRows) throw new HttpError(404, 'Item not found');
  log(req.user.name, `Edited checklist item #${rid}`);
  refreshSoon();
  res.json({ ok: true });
});

r.post('/:id/requirements', requireAuth('admin'), async (req, res) => {
  const sid = id(req.params.id, 'service');
  const b = body(req);
  const label = text(b.label, 'Document', { max: 300 });
  const detail = text(b.detail, 'Detail', { max: 500, optional: true });
  const kind = oneOf(b.kind ?? 'mandatory', ['mandatory', 'conditional'], 'type');
  const [[s]] = await pool.query('SELECT id FROM services WHERE id=?', [sid]);
  if (!s) throw new HttpError(404, 'Service not found');
  const [[{ n }]] = await pool.query('SELECT COALESCE(MAX(sort_order),0)+1 n FROM service_requirements WHERE service_id=?', [sid]);
  await pool.query('INSERT INTO service_requirements (service_id,label,detail,kind,sort_order,is_sample) VALUES (?,?,?,?,?,0)', [sid, label, detail, kind, n]);
  log(req.user.name, `Added a checklist item to service #${sid}`);
  refreshSoon();
  res.status(201).json({ ok: true });
});

r.post('/', requireAuth('admin'), async (req, res) => {
  const d = parseNewService(req.body);
  const conn = await pool.getConnection();
  let newId;
  try {
    await conn.beginTransaction();
    if (d.employee_ids.length) {
      const [found] = await conn.query("SELECT id FROM users WHERE role='employee' AND id IN (?)", [d.employee_ids]);
      if (found.length !== d.employee_ids.length) throw new HttpError(400, 'One of the employees does not exist');
    }
    const [[{ n }]] = await conn.query('SELECT COALESCE(MAX(sort_order),0)+1 n FROM services');
    const [ins] = await conn.query(
      'INSERT INTO services (purpose, grp, icon, summary, note, duration_minutes, is_active, sort_order) VALUES (?,?,?,?,?,?,1,?)',
      [d.purpose, d.grp, d.icon, d.summary, d.note, d.duration_minutes, n]);
    newId = ins.insertId;
    for (const eid of d.employee_ids) await conn.query('INSERT INTO employee_services (employee_id, service_id) VALUES (?,?)', [eid, newId]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'A service with that name already exists');
    throw e;
  } finally { conn.release(); }
  log(req.user.name, `Added service ${d.purpose}`);
  refreshSoon();
  res.status(201).json({ ok: true, id: newId });
});

r.patch('/:id', requireAuth('admin'), async (req, res) => {
  const sid = id(req.params.id, 'service');
  const d = parseServicePatch(req.body);
  const [[cur]] = await pool.query('SELECT purpose FROM services WHERE id=?', [sid]);
  if (!cur) throw new HttpError(404, 'Service not found');
  if (cur.purpose === PROTECTED_SERVICE && d.purpose !== undefined && d.purpose !== PROTECTED_SERVICE)
    throw new HttpError(400, `The "${PROTECTED_SERVICE}" service cannot be renamed. The booking forms use it to ask for a custom reason.`);
  const keys = Object.keys(d); // validated field names only, never taken from the request as-is
  try {
    await pool.query(`UPDATE services SET ${keys.map((k) => `${k}=?`).join(', ')} WHERE id=?`, [...keys.map((k) => d[k]), sid]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'A service with that name already exists');
    throw e;
  }
  log(req.user.name, `Updated service ${d.purpose || cur.purpose}`);
  refreshSoon();
  res.json({ ok: true });
});

// Deleting removes the service, its checklist and its staff assignments. Past appointments keep their service name.
r.delete('/:id', requireAuth('admin'), async (req, res) => {
  const sid = id(req.params.id, 'service');
  const [[cur]] = await pool.query('SELECT purpose FROM services WHERE id=?', [sid]);
  if (!cur) throw new HttpError(404, 'Service not found');
  if (cur.purpose === PROTECTED_SERVICE)
    throw new HttpError(400, `The "${PROTECTED_SERVICE}" service cannot be deleted. The booking forms use it to ask for a custom reason.`);
  const [[{ n }]] = await pool.query(
    `SELECT COUNT(*) n FROM appointments WHERE service_id=? AND status NOT IN ('cancelled','completed') AND appointment_date>=${sqlToday()}`, [sid]);
  if (n > 0)
    throw new HttpError(409, `${n} upcoming appointment${n === 1 ? '' : 's'} use this service. Cancel or complete ${n === 1 ? 'it' : 'them'} first, or switch the service off under "Open for booking" instead of deleting it.`);
  await pool.query('DELETE FROM services WHERE id=?', [sid]);
  log(req.user.name, `Deleted service ${cur.purpose}`);
  refreshSoon();
  res.json({ ok: true });
});

export default r;
