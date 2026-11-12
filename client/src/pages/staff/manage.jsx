import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api, fmtDate } from '../../api.js';
import Calendar from '../../components/Calendar.jsx';
import { startOfToday, yearAhead } from '../../validators.js';
import { Err } from './panels.jsx';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const Ok = ({ msg }) => (msg ? <p role="status" className="my-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">{msg}</p> : null);

/* ---------------- Picking which services an employee handles ---------------- */
const SERVICE_GROUPS = ['Register', 'Correction', 'Request', 'Other services'];
function ServicePicker({ services, ids, onChange }) {
  const active = services.filter((s) => s.is_active);
  const groups = SERVICE_GROUPS.map((g) => [g, active.filter((s) => s.grp === g)]).filter(([, l]) => l.length);
  const toggle = (id) => { const n = new Set(ids); n.has(id) ? n.delete(id) : n.add(id); onChange(n); };
  const setMany = (list, on) => { const n = new Set(ids); list.forEach((s) => (on ? n.add(s.id) : n.delete(s.id))); onChange(n); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost px-3 py-1" onClick={() => setMany(active, true)}>Select all</button>
        <button type="button" className="btn btn-ghost px-3 py-1" onClick={() => setMany(active, false)}>Clear</button>
      </div>
      {groups.map(([g, list]) => {
        const all = list.every((s) => ids.has(s.id));
        return (
          <fieldset key={g}>
            <legend className="mb-1 flex items-center gap-3 text-sm font-semibold">{g}
              <button type="button" className="text-xs font-normal text-teal underline" onClick={() => setMany(list, !all)}>{all ? 'Clear group' : 'Select group'}</button>
            </legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {list.map((s) => <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ids.has(s.id)} onChange={() => toggle(s.id)} />{s.purpose}</label>)}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

/* ---------------- Employees: add/remove, schedule, qualifications ---------------- */
function EmployeeConfig({ emp, services, onSaved }) {
  const [days, setDays] = useState(null);
  const [ids, setIds] = useState(new Set());
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => {
    api(`/employees/${emp.id}/config`).then((c) => {
      const by = Object.fromEntries(c.days.map((d) => [d.weekday, d]));
      setDays(DAYS.map((_, i) => by[i + 1] || { weekday: i + 1, is_working: 1, start_time: '08:00', end_time: '17:00', lunch_start: '12:00', lunch_end: '13:00' }));
      setIds(new Set(c.service_ids));
    }).catch((e) => setErr(e.message));
  }, [emp.id]);
  const setDay = (i, k, v) => setDays((d) => d.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const saveSchedule = async () => {
    setErr(''); setOk('');
    try {
      await api(`/employees/${emp.id}/schedule`, { method: 'PUT', body: { days: days.map((d) => ({
        weekday: d.weekday, is_working: !!d.is_working, start_time: d.start_time, end_time: d.end_time,
        lunch_start: d.lunch_start || null, lunch_end: d.lunch_end || null })) } });
      setOk('Schedule saved.');
    } catch (e) { setErr(e.message); }
  };
  const saveServices = async () => {
    setErr(''); setOk('');
    try { await api(`/employees/${emp.id}/services`, { method: 'PUT', body: { service_ids: [...ids] } }); setOk('Services saved.'); onSaved?.(); } catch (e) { setErr(e.message); }
  };
  if (!days) return <p className="p-4 text-sm text-ink/60">{err || 'Loading…'}</p>;
  return (
    <div className="space-y-6 border-t border-ink/10 bg-mist/40 p-4">
      <Err msg={err} /><Ok msg={ok} />
      <div>
        <h4 className="mb-2 font-semibold">Weekly schedule</h4>
        <div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-sm">
          <thead><tr>{['Day', 'Working', 'Start', 'End', 'Lunch from', 'Lunch to'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{days.map((d, i) => (
            <tr key={d.weekday}>
              <td className="td">{DAYS[i]}</td>
              <td className="td"><input type="checkbox" aria-label={`${DAYS[i]} working`} checked={!!d.is_working} onChange={(e) => setDay(i, 'is_working', e.target.checked ? 1 : 0)} /></td>
              {['start_time', 'end_time', 'lunch_start', 'lunch_end'].map((k) => (
                <td key={k} className="td"><input type="time" aria-label={`${DAYS[i]} ${k.replace('_', ' ')}`} className="input" value={d[k] || ''} onChange={(e) => setDay(i, k, e.target.value)} /></td>
              ))}
            </tr>))}</tbody>
        </table></div>
        <p className="mt-1 text-xs text-ink/60">Clients can only book inside the office-wide booking hours, even if the shift is longer. Clear both lunch fields for no lunch break.</p>
        <button className="btn btn-primary mt-2" onClick={saveSchedule}>Save schedule</button>
      </div>
      <div>
        <h4 className="mb-2 font-semibold">Services {emp.name} can handle</h4>
        <ServicePicker services={services} ids={ids} onChange={setIds} />
        <button className="btn btn-primary mt-3" onClick={saveServices}>Save services</button>
      </div>
    </div>
  );
}

export function EmployeesPanel({ employees, reload }) {
  const [f, setF] = useState({ name: '', email: '', password: '', service_ids: [], is_front_desk: false });
  const [services, setServices] = useState([]);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => { api('/services/admin').then(setServices).catch(() => {}); }, []);
  const add = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    if (!f.service_ids.length && !window.confirm('No services are selected. This employee will not receive any clients until you assign services. Add anyway?')) return;
    try {
      await api('/employees', { method: 'POST', body: f });
      setOk(`${f.name} was added.`); setF({ name: '', email: '', password: '', service_ids: [], is_front_desk: false }); reload();
    } catch (x) { setErr(x.message); }
  };
  const del = async (u) => {
    const n = u.open_appointments;
    if (!window.confirm(`Remove ${u.name}?${n ? ` ${n} upcoming appointment(s) will become unassigned and need a new employee.` : ''} Their schedule and blocked hours are deleted.`)) return;
    try { await api(`/employees/${u.id}`, { method: 'DELETE' }); reload(); } catch (x) { setErr(x.message); }
  };
  const setFrontDesk = async (u, on) => {
    setErr(''); setOk('');
    try { await api(`/employees/${u.id}/front-desk`, { method: 'PUT', body: { is_front_desk: on } }); setOk(`${u.name} ${on ? 'is now front desk' : 'is no longer front desk'}.`); reload(); } catch (x) { setErr(x.message); }
  };
  const chips = (u) => {
    if (!u.services?.length) return <span className="text-amber-800">No services assigned</span>;
    const names = u.services.map((s) => s.purpose);
    return <>{names.slice(0, 4).join(', ')}{names.length > 4 && ` +${names.length - 4} more`}</>;
  };
  return (
    <div className="space-y-8">
      <Err msg={err} /><Ok msg={ok} />
      <form onSubmit={add} className="rounded-xl border border-ink/15 bg-white p-5">
        <h3 className="text-xl">Add an employee</h3>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div><label className="label" htmlFor="an">Full name</label><input id="an" required maxLength={120} placeholder="e.g. Jacob Santos" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><label className="label" htmlFor="ae">Email</label><input id="ae" type="email" required maxLength={160} placeholder="e.g. jacob@yourdomain.gov.ph" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><label className="label" htmlFor="ap">Temporary password</label><input id="ap" type="password" minLength={10} maxLength={72} required placeholder="At least 10 characters, letters and numbers" autoComplete="new-password" className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
            <p className="text-xs text-ink/60">Password: 10+ characters with letters and numbers. New employees get the default Monday to Friday schedule, which you can change afterwards.</p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_front_desk} onChange={(e) => setF({ ...f, is_front_desk: e.target.checked })} />Front desk: can open all appointments, everyone’s workload, capacity and walk-ins, and update any appointment</label>
          </div>
          <div>
            <p className="label">Services this employee will handle</p>
            <ServicePicker services={services} ids={new Set(f.service_ids)} onChange={(n) => setF({ ...f, service_ids: [...n] })} />
            <p className="mt-2 text-xs text-ink/60">Clients are only booked with staff assigned to their service, so the people you assign decide how many clients the office can handle for each service.</p>
          </div>
        </div>
        <button className="btn btn-primary mt-5">Add employee</button>
      </form>

      <ul className="divide-y divide-ink/10 rounded-lg border border-ink/15 bg-white">
        {employees.map((u) => (
          <li key={u.id}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{u.name}{!!u.is_front_desk && <span className="ml-2 rounded bg-seal/30 px-2 py-0.5 text-xs font-medium">Front desk</span>}</p>
                <p className="text-xs text-ink/60">{u.email} · {u.open_appointments} upcoming appointment(s)</p>
                <p className="mt-1 text-sm text-ink/80">Handles: {chips(u)}</p>
                <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!u.is_front_desk} onChange={(e) => setFrontDesk(u, e.target.checked)} />Front desk <span className="text-xs text-ink/50">(opens all appointments, workload, capacity and walk-ins)</span></label>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost px-3 py-1.5" aria-expanded={open === u.id} onClick={() => setOpen(open === u.id ? null : u.id)}>Edit services and schedule</button>
                <button className="btn btn-danger px-2 py-2" aria-label={`Remove ${u.name}`} onClick={() => del(u)}><Trash2 size={16} /></button>
              </div>
            </div>
            {open === u.id && <EmployeeConfig emp={u} services={services} onSaved={reload} />}
          </li>))}
        {!employees.length && <li className="px-4 py-6 text-sm text-ink/60">No employees yet. Without employees, no appointment times are available.</li>}
      </ul>
    </div>
  );
}

/* ---------------- Services: durations and document checklists ---------------- */
function RequirementRow({ r, reload, setErr }) {
  const [v, setV] = useState({ label: r.label, kind: r.kind, is_active: !!r.is_active });
  const dirty = v.label !== r.label || v.kind !== r.kind || v.is_active !== !!r.is_active;
  const save = async () => { setErr(''); try { await api(`/services/requirements/${r.id}`, { method: 'PATCH', body: v }); reload(); } catch (e) { setErr(e.message); } };
  return (
    <li className={`flex flex-wrap items-center gap-2 py-2 ${v.is_active ? '' : 'opacity-60'}`}>
      <input aria-label="Document" className="input min-w-[16rem] flex-1" maxLength={300} placeholder="Document name" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} />
      <select aria-label="Type" className="input w-auto" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}><option value="mandatory">Mandatory</option><option value="conditional">Conditional</option></select>
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />Active</label>
      {!!r.is_sample && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900" title="Sample text. Verify it, then edit or save it to mark it reviewed.">Sample: verify</span>}
      <button className="btn btn-primary px-3 py-1.5" disabled={!dirty && !r.is_sample} onClick={save}>{dirty ? 'Save' : r.is_sample ? 'Mark reviewed' : 'Saved'}</button>
    </li>
  );
}

const SERVICE_GROUPS_LIST = ['Register', 'Correction', 'Request', 'Other services'];
const ICON_OPTIONS = [['register', 'Register'], ['correction', 'Correction'], ['request', 'Request'], ['late', 'Late registration'], ['supplemental', 'Supplemental'], ['acknowledgment', 'Acknowledgment'], ['legitimation', 'Legitimation'], ['out', 'Out of town'], ['other', 'Other']];
const DEFAULT_ICON = { Register: 'register', Correction: 'correction', Request: 'request', 'Other services': 'other' };
const SERVICE_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N}\s/&().,'’-]*$/u;

function serviceProblem(d) {
  const name = d.purpose.trim();
  if (name.length < 3) return 'Enter the service name (at least 3 characters).';
  if (name.length > 120 || !SERVICE_NAME_RE.test(name)) return 'The service name can only contain letters, numbers, spaces and / & ( ) . , \' - (up to 120 characters).';
  const mins = Number(d.duration);
  if (!Number.isInteger(mins) || mins < 5 || mins > 240 || mins % 5) return 'The visit length must be 5 to 240 minutes, in steps of 5.';
  if (d.summary.length > 500 || d.note.length > 500) return 'The short description and the note can each be up to 500 characters.';
  if ((d.details || '').length > 2000) return 'The detailed description can be up to 2000 characters.';
  return '';
}

function ServiceCard({ s, reload, setErr, setOk }) {
  const locked = s.purpose === 'Others'; // the booking forms use this one to ask for a custom reason
  const [d, setD] = useState({ purpose: s.purpose, grp: s.grp, icon: s.icon, summary: s.summary || '', note: s.note || '', details: s.details || '', duration: String(s.duration_minutes) });
  const [item, setItem] = useState({ label: '', kind: 'mandatory' });
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  const changed = d.purpose !== s.purpose || d.grp !== s.grp || d.icon !== s.icon || d.summary !== (s.summary || '') || d.note !== (s.note || '') || d.details !== (s.details || '') || Number(d.duration) !== s.duration_minutes;

  const patch = async (body, msg) => { setErr(''); setOk(''); try { await api(`/services/${s.id}`, { method: 'PATCH', body }); setOk(msg); reload(); } catch (e) { setErr(e.message); } };
  const saveDetails = () => {
    const problem = serviceProblem(d);
    if (problem) { setOk(''); return setErr(problem); }
    patch({ purpose: d.purpose.trim(), grp: d.grp, icon: d.icon, summary: d.summary.trim(), note: d.note.trim(), details: d.details.trim(), duration_minutes: Number(d.duration) }, `${d.purpose.trim()} saved. Changes apply to new bookings and to the home page.`);
  };
  const remove = async () => {
    if (!window.confirm(`Delete "${s.purpose}"?\n\nThis removes the service, its document checklist and its staff assignments. Past appointments keep the service name. This cannot be undone.\n\nTo hide it without deleting, switch off "Open for booking" instead.`)) return;
    setErr(''); setOk('');
    try { await api(`/services/${s.id}`, { method: 'DELETE' }); setOk(`${s.purpose} was deleted.`); reload(); } catch (e) { setErr(e.message); }
  };
  const addItem = async (e) => {
    e.preventDefault(); setErr('');
    try { await api(`/services/${s.id}/requirements`, { method: 'POST', body: item }); setItem({ label: '', kind: 'mandatory' }); reload(); } catch (x) { setErr(x.message); }
  };

  return (
    <details className="rounded-lg border border-ink/15 bg-white">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="font-medium">{s.purpose}{!s.is_active && <span className="ml-2 text-xs text-ink/50">(inactive)</span>}</span>
        <span className="text-sm text-ink/60">{s.duration_minutes} min · {s.requirements.filter((r) => r.is_active).length} active document(s) · {s.staff_count ? `${s.staff_count} staff` : <span className="font-medium text-amber-800">no staff assigned</span>}</span>
      </summary>
      <div className="space-y-6 border-t border-ink/10 p-4">
        <div className="space-y-3">
          <h4 className="font-semibold">Service details</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label" htmlFor={`pn${s.id}`}>Service name</label>
              <input id={`pn${s.id}`} className="input" maxLength={120} placeholder="e.g. Request of Birth" value={d.purpose} readOnly={locked} onChange={(e) => set('purpose', e.target.value)} />
              {locked && <p className="mt-1 text-xs text-ink/60">This service asks visitors for a custom reason, so it cannot be renamed or deleted.</p>}
            </div>
            <div><label className="label" htmlFor={`pg${s.id}`}>Group</label>
              <select id={`pg${s.id}`} className="input" value={d.grp} onChange={(e) => set('grp', e.target.value)}>{SERVICE_GROUPS_LIST.map((g) => <option key={g}>{g}</option>)}</select></div>
            <div><label className="label" htmlFor={`pi${s.id}`}>Home page icon</label>
              <select id={`pi${s.id}`} className="input" value={d.icon} onChange={(e) => set('icon', e.target.value)}>{ICON_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><label className="label" htmlFor={`d${s.id}`}>Visit length (minutes)</label>
              <input id={`d${s.id}`} type="number" min={5} max={240} step={5} placeholder="20" className="input w-32" value={d.duration} onChange={(e) => set('duration', e.target.value)} /></div>
            <div className="md:col-span-2">
              <label className="label" htmlFor={`ps${s.id}`}>Short description</label>
              <textarea id={`ps${s.id}`} rows={2} maxLength={500} className="input" placeholder="One or two sentences telling visitors what this service is for" value={d.summary} onChange={(e) => set('summary', e.target.value)} />
              <p className="mt-1 text-xs text-ink/55">{d.summary.length}/500. Shown on the home page card and read by the chatbot.</p>
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor={`pt${s.id}`}>Note</label>
              <textarea id={`pt${s.id}`} rows={2} maxLength={500} className="input" placeholder="Optional. Anything visitors should know, such as a reminder or a limit" value={d.note} onChange={(e) => set('note', e.target.value)} />
              <p className="mt-1 text-xs text-ink/55">{d.note.length}/500. Shown at the bottom of the home page card and read by the chatbot. Leave empty for no note.</p>
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor={`pd${s.id}`}>Detailed description</label>
              <textarea id={`pd${s.id}`} rows={8} maxLength={2000} className="input" placeholder="Explain in plain language what this service is, who needs it, and how it differs from similar services. Leave a blank line between paragraphs." value={d.details} onChange={(e) => set('details', e.target.value)} />
              <p className="mt-1 text-xs text-ink/55">{d.details.length}/2000. Shown on the About Us page (the card on the home page links there) and read by the chatbot. Have the registrar check what you write.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button className="btn btn-primary" disabled={!changed} onClick={saveDetails}>Save details</button>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!s.is_active} onChange={(e) => patch({ is_active: e.target.checked }, `${s.purpose} is now ${e.target.checked ? 'open' : 'closed'} for booking.`)} />Open for booking</label>
            <button className="btn btn-danger ml-auto" disabled={locked} title={locked ? 'This service cannot be deleted' : undefined} onClick={remove}><Trash2 size={16} />Delete service</button>
          </div>
        </div>
        <div>
          <h4 className="font-semibold">Document checklist</h4>
          <ul className="divide-y divide-ink/10">{s.requirements.map((r) => <RequirementRow key={r.id} r={r} reload={reload} setErr={setErr} />)}</ul>
          {!s.requirements.length && <p className="text-sm text-ink/60">No documents yet.</p>}
          <form onSubmit={addItem} className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1"><label className="label" htmlFor={`n${s.id}`}>Add a document</label><input id={`n${s.id}`} required maxLength={300} placeholder="e.g. Valid government-issued ID" className="input" value={item.label} onChange={(e) => setItem({ ...item, label: e.target.value })} /></div>
            <select aria-label="Type" className="input w-auto" value={item.kind} onChange={(e) => setItem({ ...item, kind: e.target.value })}><option value="mandatory">Mandatory</option><option value="conditional">Conditional</option></select>
            <button className="btn btn-ghost">Add</button>
          </form>
        </div>
      </div>
    </details>
  );
}

function AddService({ employees, reload, setErr, setOk }) {
  const blank = { purpose: '', grp: 'Other services', icon: '', summary: '', note: '', details: '', duration: '30', employee_ids: [] };
  const [d, setD] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  const toggle = (id) => set('employee_ids', d.employee_ids.includes(id) ? d.employee_ids.filter((x) => x !== id) : [...d.employee_ids, id]);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    const problem = serviceProblem(d);
    if (problem) return setErr(problem);
    setBusy(true);
    try {
      await api('/services', { method: 'POST', body: {
        purpose: d.purpose.trim(), grp: d.grp, icon: d.icon || DEFAULT_ICON[d.grp], summary: d.summary.trim(), note: d.note.trim(), details: d.details.trim(),
        duration_minutes: Number(d.duration), employee_ids: d.employee_ids } });
      setOk(`${d.purpose.trim()} was added.${d.employee_ids.length ? '' : ' Nobody is assigned to it yet, so clients cannot book it. Assign staff in Employees or tick them here next time.'} Now add its document checklist below.`);
      setD(blank); reload();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <details className="rounded-xl border border-seal/60 bg-paper">
      <summary className="cursor-pointer px-4 py-3 font-semibold">+ Add a service</summary>
      <form onSubmit={submit} className="space-y-3 border-t border-ink/10 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><label className="label" htmlFor="as-name">Service name</label>
            <input id="as-name" required className="input" maxLength={120} placeholder="e.g. Delayed Registration of Marriage" value={d.purpose} onChange={(e) => set('purpose', e.target.value)} /></div>
          <div><label className="label" htmlFor="as-group">Group</label>
            <select id="as-group" className="input" value={d.grp} onChange={(e) => set('grp', e.target.value)}>{SERVICE_GROUPS_LIST.map((g) => <option key={g}>{g}</option>)}</select></div>
          <div><label className="label" htmlFor="as-icon">Home page icon</label>
            <select id="as-icon" className="input" value={d.icon} onChange={(e) => set('icon', e.target.value)}><option value="">Automatic (from the group)</option>{ICON_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label className="label" htmlFor="as-dur">Visit length (minutes)</label>
            <input id="as-dur" type="number" required min={5} max={240} step={5} placeholder="30" className="input w-32" value={d.duration} onChange={(e) => set('duration', e.target.value)} /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="as-sum">Short description</label>
            <textarea id="as-sum" rows={2} maxLength={500} className="input" placeholder="One or two sentences telling visitors what this service is for" value={d.summary} onChange={(e) => set('summary', e.target.value)} /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="as-note">Note (optional)</label>
            <textarea id="as-note" rows={2} maxLength={500} className="input" placeholder="Anything visitors should know" value={d.note} onChange={(e) => set('note', e.target.value)} /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="as-details">Detailed description (optional)</label>
            <textarea id="as-details" rows={5} maxLength={2000} className="input" placeholder="Explain in plain language what this service is and who needs it. It appears on the About Us page." value={d.details} onChange={(e) => set('details', e.target.value)} /></div>
        </div>
        <fieldset>
          <legend className="label">Staff who will handle it</legend>
          <div className="grid gap-1 sm:grid-cols-2 md:grid-cols-3">
            {employees.map((u) => <label key={u.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.employee_ids.includes(u.id)} onChange={() => toggle(u.id)} />{u.name}</label>)}
            {!employees.length && <p className="text-sm text-ink/60">No employees yet.</p>}
          </div>
          <p className="mt-1 text-xs text-ink/55">Clients can only book a service that has staff assigned. You can change this later in Employees.</p>
        </fieldset>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add service'}</button>
      </form>
    </details>
  );
}

export function ServicesPanel() {
  const [services, setServices] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const load = useCallback(() => api('/services/admin').then(setServices).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); api('/employees').then(setEmployees).catch(() => {}); }, [load]);
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Checklist items marked “Sample: verify” are placeholders. Replace them with your office’s officially approved requirements. Clients see mandatory and conditional items separately before booking, and each booking keeps a copy of the list it was shown.</p>
      <Err msg={err} /><Ok msg={ok} />
      <AddService employees={employees} reload={load} setErr={setErr} setOk={setOk} />
      {!services && !err && <p className="text-sm text-ink/60">Loading…</p>}
      {services?.map((s) => <ServiceCard key={s.id} s={s} reload={load} setErr={setErr} setOk={setOk} />)}
    </div>
  );
}

/* ---------------- Settings: hours, capacity, walk-ins, closed dates ---------------- */
export function SettingsPanel() {
  const [f, setF] = useState(null);
  const [limitMode, setLimitMode] = useState('auto');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [days, setDays] = useState([]);
  const [closed, setClosed] = useState({ date: '', reason: '' });
  const loadDays = useCallback(() => api('/employees/blocked-dates').then(setDays).catch(() => {}), []);
  useEffect(() => { api('/settings').then((x) => { setF(x); setLimitMode(Number(x.daily_online_limit) === 0 ? 'auto' : 'fixed'); }).catch((e) => setErr(e.message)); loadDays(); }, [loadDays]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    try {
      const body = {
        office_open: f.office_open, office_close: f.office_close, booking_start: f.booking_start, booking_end: f.booking_end,
        buffer_minutes: Number(f.buffer_minutes), slot_step_minutes: Number(f.slot_step_minutes), daily_online_limit: limitMode === 'auto' ? 0 : Number(f.daily_online_limit),
        walkin_enabled: !!f.walkin_enabled, walkin_reserve_percent: Number(f.walkin_reserve_percent), walkin_release: f.walkin_release,
        walkin_release_time: f.walkin_release_time, max_days_ahead: Number(f.max_days_ahead), checklist_notice: f.checklist_notice,
      };
      setF(await api('/settings', { method: 'PUT', body })); setOk('Settings saved. They apply to new bookings.');
    } catch (x) { setErr(x.message); }
  };
  const closeDay = async (e) => {
    e.preventDefault(); setErr('');
    try { await api('/employees/blocked-dates', { method: 'POST', body: closed }); setClosed({ date: '', reason: '' }); loadDays(); } catch (x) { setErr(x.message); }
  };
  const openDay = async (id) => { try { await api(`/employees/blocked-dates/${id}`, { method: 'DELETE' }); loadDays(); } catch (x) { setErr(x.message); } };
  if (!f) return <Err msg={err} />;
  const T = (k, label) => <div key={k}><label className="label" htmlFor={k}>{label}</label><input id={k} type="time" required className="input" value={f[k]} onChange={(e) => set(k, e.target.value)} /></div>;
  const N = (k, label, min, max, hint) => <div key={k}><label className="label" htmlFor={k}>{label}</label><input id={k} type="number" required min={min} max={max} className="input" value={f[k]} onChange={(e) => set(k, e.target.value)} />{hint && <p className="mt-1 text-xs text-ink/60">{hint}</p>}</div>;
  return (
    <div className="space-y-10">
      <form onSubmit={save} className="space-y-8">
        <Err msg={err} /><Ok msg={ok} />
        <section><h3 className="mb-3 text-xl">Hours</h3>
          <div className="grid gap-4 sm:grid-cols-4">{T('office_open', 'Office opens')}{T('office_close', 'Office closes')}{T('booking_start', 'Appointments start')}{T('booking_end', 'Appointments end')}</div>
          <p className="mt-1 text-xs text-ink/60">Appointment hours must fall inside office hours. A visit must finish by the appointment end time.</p></section>
        <section><h3 className="mb-3 text-xl">Booking and capacity</h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <div><label className="label" htmlFor="buffer_minutes">Buffer between visits</label>
              <select id="buffer_minutes" className="input" value={f.buffer_minutes} onChange={(e) => set('buffer_minutes', e.target.value)}>{[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></div>
            <div><label className="label" htmlFor="slot_step_minutes">Time options every</label>
              <select id="slot_step_minutes" className="input" value={f.slot_step_minutes} onChange={(e) => set('slot_step_minutes', e.target.value)}>{[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></div>
            <div>
              <label className="label" htmlFor="limit_mode">Online appointments per day</label>
              <select id="limit_mode" className="input" value={limitMode} onChange={(e) => { setLimitMode(e.target.value); if (e.target.value === 'fixed' && !Number(f.daily_online_limit)) set('daily_online_limit', 65); }}>
                <option value="auto">Automatic (from staff assigned to each service)</option>
                <option value="fixed">Fixed limit</option>
              </select>
              {limitMode === 'fixed' && <input aria-label="Fixed daily limit" type="number" required min={1} max={500} placeholder="e.g. 60" className="input mt-2" value={f.daily_online_limit} onChange={(e) => set('daily_online_limit', e.target.value)} />}
              <p className="mt-1 text-xs text-ink/60">Automatic uses the working time of the employees assigned to each service. A fixed limit also caps the day’s total.</p>
            </div>
            {N('max_days_ahead', 'Book up to (days ahead)', 1, 180)}
          </div></section>
        <section><h3 className="mb-3 text-xl">Walk-ins</h3>
          <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.walkin_enabled} onChange={(e) => set('walkin_enabled', e.target.checked)} />Reserve part of each day’s capacity for walk-ins</label>
          <div className="grid gap-4 sm:grid-cols-3">
            {N('walkin_reserve_percent', 'Reserved share (%)', 0, 60, "Of the day’s usable staff time, calculated from who is working.")}
            <div><label className="label" htmlFor="walkin_release">Unused reserve</label>
              <select id="walkin_release" className="input" value={f.walkin_release} onChange={(e) => set('walkin_release', e.target.value)}><option value="never">Never release to online booking</option><option value="same_day_time">Release to online booking on the same day</option></select></div>
            {f.walkin_release === 'same_day_time' && T('walkin_release_time', 'Release from')}
          </div></section>
        <section><h3 className="mb-3 text-xl">Document checklist notice</h3>
          <label className="sr-only" htmlFor="checklist_notice">Notice shown with every checklist</label>
          <textarea id="checklist_notice" rows={3} maxLength={600} required placeholder="A short notice shown with every document checklist" className="input" value={f.checklist_notice} onChange={(e) => set('checklist_notice', e.target.value)} /></section>
        <button className="btn btn-primary">Save settings</button>
      </form>

      <section className="grid gap-8 md:grid-cols-2">
        <form onSubmit={closeDay} className="space-y-3">
          <h3 className="text-xl">Close the whole office on a date</h3>
          <div>
            <p className="label">Date</p>
            <Calendar value={closed.date} onChange={(d) => setClosed({ ...closed, date: d })} min={startOfToday()} max={yearAhead()} hint="Weekends and past dates can’t be selected." />
            {closed.date && <p className="mt-2 text-sm">Selected: <b className="font-semibold">{fmtDate(closed.date)}</b></p>}
          </div>
          <div><label className="label" htmlFor="cd2">Reason (optional)</label><input id="cd2" maxLength={255} placeholder="e.g. Public holiday, office training" className="input" value={closed.reason} onChange={(e) => setClosed({ ...closed, reason: e.target.value })} /></div>
          <button className="btn btn-primary" disabled={!closed.date}>Close this date</button>
        </form>
        <div>
          <h3 className="mb-2 text-xl">Blocked dates</h3>
          <ul className="divide-y divide-ink/10 rounded-lg border border-ink/15 bg-white">
            {days.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{fmtDate(d.date)} · {d.employee_name || 'Whole office'}{d.reason && <span className="text-ink/60"> · {d.reason}</span>}</span>
                <button className="btn btn-danger px-2 py-1.5" aria-label="Remove" onClick={() => openDay(d.id)}><Trash2 size={14} /></button>
              </li>))}
            {!days.length && <li className="px-4 py-6 text-sm text-ink/60">No blocked dates.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
