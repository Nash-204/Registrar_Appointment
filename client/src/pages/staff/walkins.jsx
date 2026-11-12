import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api, fmtDate, fmtMins, fmtTime } from '../../api.js';
import { Badge, Err, StatusActions, usePoll } from './panels.jsx';
import { phoneError, emailError, nameError, arrivalError, PHONE_PLACEHOLDER } from '../../validators.js';

const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export function WalkInPanel({ admin, employees = [] }) {
  const [services, setServices] = useState([]);
  const [f, setF] = useState({ service_id: '', custom_purpose: '', full_name: '', phone: '', email: '', arrival_time: '', employee_id: '' });
  const [rows, setRows] = useState([]);
  const [ok, setOk] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const load = useCallback(async () => { try { setRows(await api('/walkins')); } catch (e) { setErr(e.message); } }, []);
  useEffect(() => { api('/services').then(setServices).catch((e) => setErr(e.message)); }, []);
  usePoll(load, 10000, []);
  const svc = services.find((s) => String(s.id) === String(f.service_id));
  const act = async (id, body) => { try { await api(`/appointments/${id}`, { method: 'PATCH', body }); load(); } catch (e) { setErr(e.message); } };

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setOk(null);
    const problem = nameError(f.full_name, 'client name') || phoneError(f.phone) || (f.email ? emailError(f.email) : '') || arrivalError(f.arrival_time);
    if (problem) { setErr(problem); return; }
    setBusy(true);
    try {
      const out = await api('/walkins', { method: 'POST', body: {
        service_id: Number(f.service_id), custom_purpose: svc?.purpose === 'Others' ? f.custom_purpose : undefined,
        full_name: f.full_name, phone: f.phone, email: f.email || undefined,
        arrival_time: f.arrival_time || undefined, employee_id: admin && f.employee_id ? Number(f.employee_id) : undefined } });
      setOk(out);
      setF({ service_id: '', custom_purpose: '', full_name: '', phone: '', email: '', arrival_time: '', employee_id: '' });
      load();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
      <form onSubmit={submit} className="space-y-3">
        <h3 className="text-xl">Register a walk-in</h3>
        <div><label className="label" htmlFor="ws">Service</label>
          <select id="ws" required className="input" value={f.service_id} onChange={(e) => set('service_id', e.target.value)}>
            <option value="">Choose…</option>{services.map((s) => <option key={s.id} value={s.id}>{s.purpose} ({s.duration_minutes} min)</option>)}
          </select></div>
        {svc?.purpose === 'Others' && <div><label className="label" htmlFor="wc">Purpose</label><input id="wc" required maxLength={255} placeholder="e.g. Certified copy of an annotated record" className="input" value={f.custom_purpose} onChange={(e) => set('custom_purpose', e.target.value)} /></div>}
        <div><label className="label" htmlFor="wn">Client name</label><input id="wn" required maxLength={120} placeholder="Juan Dela Cruz" className="input" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></div>
        <div><label className="label" htmlFor="wp">Mobile number</label><input id="wp" type="tel" inputMode="tel" required maxLength={16} placeholder={PHONE_PLACEHOLDER} className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div><label className="label" htmlFor="we">Email (optional)</label><input id="we" type="email" maxLength={160} placeholder="juan@example.com" className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div><label className="label" htmlFor="wa">Arrival time (optional)</label><input id="wa" type="time" className="input max-w-[10rem]" value={f.arrival_time} onChange={(e) => set('arrival_time', e.target.value)} />
          <p className="mt-1 text-xs text-ink/55">Leave empty to use the current time. A time from the last 15 minutes is accepted; earlier times are rejected.</p></div>
        {admin && (
          <div><label className="label" htmlFor="wemp">Assign to</label>
            <select id="wemp" className="input" value={f.employee_id} onChange={(e) => set('employee_id', e.target.value)}>
              <option value="">Auto: earliest qualified employee</option>{employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select></div>
        )}
        <Err msg={err} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Registering…' : 'Register walk-in'}</button>
        {ok && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm" role="status">
            <p className="flex items-center gap-2 font-medium"><CheckCircle2 size={16} />Registered {ok.reference_code}</p>
            <p className="mt-1">{ok.full_name} is assigned to <b>{ok.assigned_to}</b> at {fmtTime(ok.appointment_time)} (until {fmtTime(ok.end_time)}).</p>
          </div>
        )}
      </form>

      <div>
        <h3 className="mb-2 text-xl">Today’s walk-ins</h3>
        <div className="overflow-x-auto rounded-lg border border-ink/15 bg-white">
          <table className="w-full min-w-[34rem]">
            <thead className="border-b border-ink/10"><tr>{['Arrived', 'Client', 'Service', 'Assigned', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="td whitespace-nowrap">{a.arrival_time ? fmtTime(a.arrival_time) : '–'}<span className="block text-xs text-ink/60">starts {fmtTime(a.appointment_time)}</span></td>
                  <td className="td">{a.full_name}<span className="block text-xs text-ink/60">{a.phone}</span></td>
                  <td className="td">{a.purpose}{a.custom_purpose && <span className="block text-xs text-ink/60">{a.custom_purpose}</span>}<span className="block text-xs text-ink/60">{a.duration_minutes} min</span></td>
                  <td className="td">{a.handled_by_name}</td>
                  <td className="td"><Badge s={a.status} /></td>
                  <td className="td"><div className="flex flex-wrap gap-1"><StatusActions a={a} act={act} /></div></td>
                </tr>
              ))}
              {!rows.length && <tr><td className="td text-ink/60" colSpan={6}>No walk-ins registered today.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Admin: capacity, online vs walk-in ---------- */
export function CapacityPanel({ employees = [], onWalkins }) {
  const [date, setDate] = useState(today());
  const [c, setC] = useState(null);
  const [sc, setSc] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api(`/workload/capacity?date=${date}`), api(`/workload/service-capacity?date=${date}`)]);
      setC(a); setSc(b); setErr('');
    } catch (e) { setErr(e.message); }
  }, [date]);
  usePoll(load, 15000, [load]);
  const cap = c?.capacity_minutes || 0;
  const pct = (m) => (cap ? `${Math.min((m / cap) * 100, 100)}%` : '0%');
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="cd">Date</label><input id="cd" type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
        <button className="btn btn-ghost" onClick={() => setDate(today())}>Today</button>
      </div>
      <Err msg={err} />
      {c && (
        <>
          {c.closed && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">The office is closed on {fmtDate(c.date)}.</p>}
          <div>
            <div className="flex h-5 overflow-hidden rounded-full bg-ink/10" role="img" aria-label="Capacity used by online bookings, walk-ins and what remains">
              <div className="bg-teal" style={{ width: pct(c.online.minutes) }} title="Online" />
              <div className="bg-seal" style={{ width: pct(c.walkin.minutes) }} title="Walk-in" />
            </div>
            <p className="mt-2 flex flex-wrap gap-x-5 text-xs text-ink/70">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-teal" />Online</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-seal" />Walk-in</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-ink/20" />Remaining</span>
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
            {[
              ['Total capacity', fmtMins(c.capacity_minutes)],
              ['Online bookings', `${c.online.count}${c.online.limit ? ` of ${c.online.limit}` : ''} (${fmtMins(c.online.minutes)})`],
              ['Walk-ins', `${c.walkin.count} (${fmtMins(c.walkin.minutes)})`],
              ['Remaining capacity', fmtMins(c.remaining_minutes)],
              ['Reserved for walk-ins', c.walkin.enabled ? `${fmtMins(c.reserve_minutes)} (${c.walkin.reserve_percent}%)` : 'Off'],
              ['Unused reserve', fmtMins(c.unused_reserved_minutes)],
              ['Online still bookable', `${c.online.remaining_by_limit == null ? 'Automatic' : `${c.online.remaining_by_limit} by limit`}, ${fmtMins(c.online.remaining_minutes)} by time`],
              ['Reserve released to online', c.released ? 'Yes' : 'No'],
            ].map(([k, v]) => <div key={k} className="border-l-4 border-seal pl-3"><dd className="font-serif text-xl">{v}</dd><dt className="text-xs text-ink/70">{k}</dt></div>)}
          </dl>
          <p className="text-xs text-ink/60">Capacity is measured in staff minutes (working time minus lunch and blocked hours, in office hours), so a 60-minute correction uses three times as much as a 20-minute request. Each appointment is counted once, with its buffer. The reserve is {c.walkin.release === 'same_day_time' ? `released to online booking on the same day from ${fmtTime(c.walkin.release_time)}` : 'never released automatically'}. Change these in Settings.</p>
        </>
      )}
      {sc && (
        <div className="space-y-6 border-t border-ink/10 pt-8">
          <div>
            <h3 className="text-2xl">Capacity by service</h3>
            <p className="mt-1 text-sm text-ink/60">Based on each employee’s working time in appointment hours and the services they are assigned. Change assignments in Employees.</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-white p-5">
            <p className="text-sm text-ink/60">Estimated clients the office can handle on {fmtDate(sc.date)}</p>
            <p className="mt-1 font-serif text-4xl">{sc.total_clients}</p>
            <p className="mt-1 text-sm text-ink/70">About {sc.online_clients} online and {sc.walkin_reserve_clients} reserved for walk-ins.</p>
          </div>
          {sc.staff_without_services.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">These employees have no services assigned, so they add no capacity: {sc.staff_without_services.join(', ')}.</p>
          )}
          <div className="overflow-x-auto rounded-lg border border-ink/15 bg-white">
            <table className="w-full min-w-[40rem]">
              <thead className="border-b border-ink/10"><tr>{['Service', 'Visit', 'Staff assigned', 'Up to / day', 'Booked', 'Left'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink/10">
                {sc.services.map((s) => (
                  <tr key={s.id}>
                    <td className="td font-medium">{s.purpose}</td>
                    <td className="td">{s.duration_minutes} min</td>
                    <td className="td">{s.staff.length ? s.staff.map((x) => x.name).join(', ') : <span className="font-medium text-amber-800">No one assigned</span>}</td>
                    <td className="td">{s.max_clients}</td>
                    <td className="td">{s.booked}</td>
                    <td className="td">{s.left}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto rounded-lg border border-ink/15 bg-white">
            <table className="w-full min-w-[34rem]">
              <thead className="border-b border-ink/10"><tr>{['Employee', 'Handles', 'Working time', 'Clients / day'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink/10">
                {sc.employees.map((e) => {
                  const names = sc.services.filter((s) => e.service_ids.includes(s.id)).map((s) => s.purpose);
                  return (
                    <tr key={e.id}>
                      <td className="td font-medium">{e.name}</td>
                      <td className="td">{names.length ? names.join(', ') : <span className="text-amber-800">None</span>}</td>
                      <td className="td">{fmtMins(e.minutes)}</td>
                      <td className="td">{e.clients}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink/60">“Up to / day” assumes the assigned employees spend the whole day on that one service. Employees assigned to several services share their time between them, so their clients per day uses the average visit length of their services. These are estimates; booking always checks real availability.</p>
        </div>
      )}
      {onWalkins && <button className="btn btn-ghost" onClick={onWalkins}>Register a walk-in</button>}
    </div>
  );
}
