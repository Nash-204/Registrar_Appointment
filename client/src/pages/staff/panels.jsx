import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { api, fmtDate, fmtTime, BLOCK_HOURS } from '../../api.js';
import Calendar from '../../components/Calendar.jsx';
import { startOfToday, yearAhead, hourPassed } from '../../validators.js';

export function usePoll(fn, ms = 5000, deps = []) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => { ref.current(); const t = setInterval(() => ref.current(), ms); return () => clearInterval(t); }, deps);
}
export const Err = ({ msg }) => (msg ? <p role="alert" className="my-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{msg}</p> : null);
export const Badge = ({ s }) => {
  const c = { pending: 'bg-amber-100 text-amber-900', confirmed: 'bg-green-100 text-green-900', cancelled: 'bg-red-100 text-red-900', completed: 'bg-ink/10 text-ink', done: 'bg-green-100 text-green-900', in_progress: 'bg-blue-100 text-blue-900', waiting_handoff: 'bg-amber-100 text-amber-900', assigned: 'bg-blue-100 text-blue-900', bot: 'bg-mist', online: 'bg-mist', walk_in: 'bg-seal/30 text-ink' }[s] || 'bg-mist';
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${c}`}>{s.replace('_', ' ')}</span>;
};

// Status buttons that make sense for the appointment's current status.
export function StatusActions({ a, act }) {
  const go = (status, label, cls = 'btn-primary') => <button key={status} className={`btn ${cls} px-2 py-1`} onClick={() => act(a.id, { status })}>{label}</button>;
  const cancel = <button key="c" className="btn btn-danger px-2 py-1" onClick={() => window.confirm('Cancel this appointment?') && act(a.id, { status: 'cancelled' })}>Cancel</button>;
  if (a.status === 'pending') return <>{go('confirmed', 'Confirm')}{go('in_progress', 'Start', 'btn-ghost')}{cancel}</>;
  if (a.status === 'confirmed') return <>{go('in_progress', 'Start')}{cancel}</>;
  if (a.status === 'in_progress') return <>{go('completed', 'Complete')}{cancel}</>;
  if (a.status === 'cancelled') return go('pending', 'Reopen', 'btn-ghost');
  return null;
}

/* ---------------- Appointments ---------------- */
export function AppointmentsPanel({ admin, employees = [] }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [source, setSource] = useState('');
  const [sort, setSort] = useState('latest');
  const [unassigned, setUnassigned] = useState(false);
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const q = new URLSearchParams({ sort, ...(admin && { scope: 'all' }), ...(status && { status }), ...(date && { date }), ...(source && { source }), ...(unassigned && { unassigned: '1' }) });
    try { setRows(await api('/appointments?' + q)); setErr(''); } catch (e) { setErr(e.message); } finally { setLoaded(true); }
  }, [status, date, source, sort, unassigned]);
  usePoll(load, 8000, [load]);
  const act = async (id, body) => { try { await api(`/appointments/${id}`, { method: 'PATCH', body }); load(); } catch (e) { setErr(e.message); } };
  const heads = ['When', 'Client', 'Service', 'Status', ...(admin ? ['Assigned employee'] : []), ''];

  return (
    <div>
      {!admin && <p className="mb-4 text-sm text-ink/70">These are the appointments assigned to you.</p>}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="fs">Status</label>
          <select id="fs" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
          </select></div>
        <div><label className="label" htmlFor="fsrc">Source</label>
          <select id="fsrc" className="input" value={source} onChange={(e) => setSource(e.target.value)}><option value="">All</option><option value="online">Online</option><option value="walk_in">Walk-in</option></select></div>
        <div><label className="label" htmlFor="fsort">Sort</label>
          <select id="fsort" className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="latest">Latest appointment first</option><option value="earliest">Earliest appointment first</option><option value="booked">Newest booking first</option>
          </select></div>
        <div><label className="label" htmlFor="fd">Date</label><input id="fd" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {admin && <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={unassigned} onChange={(e) => setUnassigned(e.target.checked)} />Needs an employee</label>}
        {(status || date || source) && <button className="btn btn-ghost" onClick={() => { setStatus(''); setDate(''); setSource(''); }}>Clear filters</button>}
      </div>
      <Err msg={err} />
      <div className="overflow-x-auto rounded-lg border border-ink/15 bg-white">
        <table className="w-full min-w-[48rem]">
          <thead className="border-b border-ink/10"><tr>{heads.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink/10">
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="td whitespace-nowrap">{fmtDate(a.appointment_date)}<br /><span className="text-ink/60">{fmtTime(a.appointment_time)}{a.end_time && ` – ${fmtTime(a.end_time)}`}</span></td>
                <td className="td">{a.full_name}<br /><span className="text-xs text-ink/60">{[a.email, a.phone].filter(Boolean).join(' · ')}</span><br /><span className="text-xs text-ink/60">{a.reference_code}</span></td>
                <td className="td">{a.purpose}{a.custom_purpose && <span className="block text-xs text-ink/60">{a.custom_purpose}</span>}<span className="mt-1 flex items-center gap-2 text-xs text-ink/60">{a.duration_minutes} min <Badge s={a.source} /></span></td>
                <td className="td"><Badge s={a.status} /></td>
                {admin && (
                  <td className="td">
                    <select aria-label={`Assign ${a.reference_code} to an employee`} className="input min-w-[10rem]" value={a.handled_by || ''}
                      onChange={(e) => act(a.id, { assign_to: e.target.value || null })}>
                      <option value="">{a.status === 'cancelled' ? 'Unassigned' : 'Assign to…'}</option>
                      {employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    {!a.handled_by && a.status !== 'cancelled' && <span className="mt-1 block text-xs text-amber-800">Needs an employee</span>}
                  </td>
                )}
                <td className="td"><div className="flex flex-wrap gap-1"><StatusActions a={a} act={act} /></div></td>
              </tr>
            ))}
            {!rows.length && <tr><td className="td text-ink/60" colSpan={heads.length}>{!loaded ? 'Loading…' : admin ? 'No appointments match these filters.' : 'Nothing assigned to you yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Chats ---------------- */
export function ChatsPanel({ admin, employees = [] }) {
  const [sessions, setSessions] = useState([]);
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const last = useRef(0);
  const end = useRef(null);

  usePoll(async () => { try { setSessions(await api('/chat/staff/sessions')); } catch (e) { setErr(e.message); } }, 4000, []);
  usePoll(async () => {
    if (!sel) return;
    try {
      const d = await api(`/chat/staff/sessions/${sel}/messages?after=${last.current}`);
      if (d.messages.length) { last.current = d.messages.at(-1).id; setMsgs((m) => [...m, ...d.messages]); }
    } catch (e) { setErr(e.message); }
  }, 2500, [sel]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  const pick = (id) => { setSel(id); setMsgs([]); last.current = 0; setErr(''); };
  const current = sessions.find((s) => s.id === sel);
  const send = async (e) => {
    e.preventDefault(); if (!text.trim()) return;
    const m = text; setText('');
    try { await api(`/chat/staff/sessions/${sel}/messages`, { method: 'POST', body: { message: m } }); } catch (x) { setErr(x.message); }
  };
  const assign = async (employee_id) => { try { await api(`/chat/staff/sessions/${sel}/assign`, { method: 'POST', body: { employee_id } }); } catch (x) { setErr(x.message); } };
  const close = async () => { if (!window.confirm('End this chat?')) return; try { await api(`/chat/staff/sessions/${sel}/close`, { method: 'POST' }); setSel(null); } catch (x) { setErr(x.message); } };

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <ul className="max-h-[32rem] divide-y divide-ink/10 overflow-y-auto rounded-lg border border-ink/15 bg-white">
        {sessions.map((s) => (
          <li key={s.id}>
            <button onClick={() => pick(s.id)} className={`w-full px-3 py-3 text-left hover:bg-mist ${sel === s.id ? 'bg-mist' : ''}`}>
              <span className="flex items-center justify-between gap-2"><span className="font-medium">{s.visitor_name}</span><Badge s={s.status} /></span>
              <span className="mt-1 block truncate text-xs text-ink/60">{s.last_message}</span>
              {s.assigned_name && <span className="text-xs text-ink/60">With {s.assigned_name}</span>}
            </button>
          </li>
        ))}
        {!sessions.length && <li className="p-4 text-sm text-ink/60">{admin ? 'No active chats.' : 'No chats assigned to you yet.'}</li>}
      </ul>

      <div className="flex min-h-[24rem] flex-col rounded-lg border border-ink/15 bg-white">
        {!current ? <p className="m-auto text-sm text-ink/60">Select a chat to read it.</p> : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 p-3">
              <p className="font-medium">{current.visitor_name}{current.visitor_email && <span className="ml-2 text-xs text-ink/60">{current.visitor_email}</span>}</p>
              <div className="flex items-center gap-2">
                {admin && (
                  <select aria-label="Assign to employee" className="input w-auto" value={current.assigned_employee_id || ''} onChange={(e) => e.target.value && assign(e.target.value)}>
                    <option value="">Assign to…</option>{employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                )}
                <button className="btn btn-danger px-3 py-1.5" onClick={close}>End chat</button>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto bg-mist/40 p-3" style={{ maxHeight: '24rem' }}>
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.sender_type === 'employee' ? 'justify-end' : 'justify-start'}`}>
                  <p className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.sender_type === 'employee' ? 'bg-teal text-white' : m.sender_type === 'bot' ? 'border border-ink/15 bg-white text-ink/70' : 'bg-white'}`}>
                    <span className="mb-0.5 block text-xs opacity-70">{m.sender_type === 'visitor' ? current.visitor_name : m.sender_type === 'bot' ? 'Bot' : 'Staff'}</span>{m.message}
                  </p>
                </div>
              ))}
              <div ref={end} />
            </div>
            <Err msg={err} />
            {current.status === 'assigned' || (admin && current.status !== 'bot') ? (
              <form onSubmit={send} className="flex gap-2 border-t border-ink/10 p-3">
                <input className="input" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply to the visitor" aria-label="Reply" />
                <button className="btn btn-primary" aria-label="Send"><Send size={16} /></button>
              </form>
            ) : <p className="border-t border-ink/10 p-3 text-sm text-ink/60">{current.status === 'waiting_handoff' ? 'Assign this chat to an employee so they can reply.' : 'The bot is still handling this chat.'}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Schedule blocking ---------------- */
export function BlockPanel() {
  const [rows, setRows] = useState([]);
  const [days, setDays] = useState([]);
  const [date, setDate] = useState('');
  const [picked, setPicked] = useState([]);
  const [reason, setReason] = useState('');
  const [dayDate, setDayDate] = useState('');
  const [dayReason, setDayReason] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { setRows(await api('/employees/blocked')); setDays(await api('/employees/blocked-dates')); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const toggle = (s) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const add = async (e) => {
    e.preventDefault(); setErr('');
    try { await api('/employees/blocked', { method: 'POST', body: { date, time_slots: picked, reason } }); setPicked([]); setReason(''); load(); } catch (x) { setErr(x.message); }
  };
  const addDay = async (e) => {
    e.preventDefault(); setErr('');
    try { await api('/employees/blocked-dates', { method: 'POST', body: { date: dayDate, reason: dayReason } }); setDayDate(''); setDayReason(''); load(); } catch (x) { setErr(x.message); }
  };
  const del = async (id) => { try { await api(`/employees/blocked/${id}`, { method: 'DELETE' }); load(); } catch (x) { setErr(x.message); } };
  const delDay = async (id) => { try { await api(`/employees/blocked-dates/${id}`, { method: 'DELETE' }); load(); } catch (x) { setErr(x.message); } };
  return (
    <div className="space-y-10">
      <Err msg={err} />
      <div className="grid gap-8 md:grid-cols-2">
        <form onSubmit={add} className="space-y-4">
          <h3 className="text-xl">Block hours</h3>
          <p className="text-sm text-ink/70">Each block covers one hour from the time shown. Clients cannot book you during blocked hours.</p>
          <div>
            <p className="label">Date</p>
            <Calendar value={date} onChange={(d) => { setDate(d); setPicked((p) => p.filter((h) => !hourPassed(d, h))); }} min={startOfToday()} max={yearAhead()} hint="Weekends and past dates can’t be selected." />
            {date && <p className="mt-2 text-sm">Selected: <b className="font-semibold">{fmtDate(date)}</b></p>}
          </div>
          <fieldset><legend className="label">Hours to block</legend>
            <div className="flex flex-wrap gap-2">{BLOCK_HOURS.map((s) => (
              <label key={s} className={`rounded-lg border px-3 py-1.5 text-sm ${hourPassed(date, s) ? 'cursor-not-allowed border-ink/10 bg-mist text-ink/35 line-through' : picked.includes(s) ? 'cursor-pointer border-teal bg-teal text-white' : 'cursor-pointer border-ink/20 bg-white'}`}>
                <input type="checkbox" className="sr-only" disabled={hourPassed(date, s)} checked={picked.includes(s)} onChange={() => toggle(s)} />{fmtTime(s)}
              </label>))}</div>
            <p className="mt-1 text-xs text-ink/55">Hours that have already passed today are crossed out.</p></fieldset>
          <div><label className="label" htmlFor="br">Reason (optional)</label><input id="br" className="input" maxLength={255} placeholder="e.g. Training, meeting, leave" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <button className="btn btn-primary" disabled={!date || !picked.length}>Block selected hours</button>
        </form>
        <div>
          <h3 className="mb-2 text-xl">Your blocked hours</h3>
          <ul className="divide-y divide-ink/10 rounded-lg border border-ink/15 bg-white">
            {rows.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{fmtDate(b.date)}, {fmtTime(b.time_slot)}{b.reason && <span className="text-ink/60"> · {b.reason}</span>}</span>
                <button className="btn btn-danger px-2 py-1.5" aria-label="Unblock" onClick={() => del(b.id)}><Trash2 size={14} /></button>
              </li>))}
            {!rows.length && <li className="px-4 py-6 text-sm text-ink/60">Nothing blocked.</li>}
          </ul>
        </div>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <form onSubmit={addDay} className="space-y-4">
          <h3 className="text-xl">Block a whole day</h3>
          <div>
            <p className="label">Date</p>
            <Calendar value={dayDate} onChange={setDayDate} min={startOfToday()} max={yearAhead()} hint="Weekends and past dates can’t be selected." />
            {dayDate && <p className="mt-2 text-sm">Selected: <b className="font-semibold">{fmtDate(dayDate)}</b></p>}
          </div>
          <div><label className="label" htmlFor="dr">Reason (optional)</label><input id="dr" className="input" maxLength={255} placeholder="e.g. Day off, seminar" value={dayReason} onChange={(e) => setDayReason(e.target.value)} /></div>
          <button className="btn btn-primary" disabled={!dayDate}>Block this day</button>
        </form>
        <div>
          <h3 className="mb-2 text-xl">Blocked days</h3>
          <ul className="divide-y divide-ink/10 rounded-lg border border-ink/15 bg-white">
            {days.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{fmtDate(b.date)} · {b.employee_id ? 'You' : 'Whole office'}{b.reason && <span className="text-ink/60"> · {b.reason}</span>}</span>
                {b.employee_id && <button className="btn btn-danger px-2 py-1.5" aria-label="Unblock day" onClick={() => delDay(b.id)}><Trash2 size={14} /></button>}
              </li>))}
            {!days.length && <li className="px-4 py-6 text-sm text-ink/60">No blocked days.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Overview (admin) ---------------- */
export function OverviewPanel() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  usePoll(async () => { try { setS(await api('/stats')); } catch (e) { setErr(e.message); } }, 10000, []);
  if (!s) return <Err msg={err} />;
  const items = [['Appointments today', s.appointmentsToday], ['Pending approval', s.pending], ['Upcoming', s.upcoming], ['Employees', s.employees], ['Need an employee', s.unassigned], ['Chats waiting', s.waitingChats], ['Active chats', s.activeChats]];
  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        {items.map(([k, v]) => <div key={k} className="border-l-4 border-seal pl-3"><dd className="font-serif text-3xl">{v}</dd><dt className="text-sm text-ink/70">{k}</dt></div>)}
      </dl>
      <div>
        <h3 className="mb-2 text-xl">Recent activity</h3>
        <ul className="divide-y divide-ink/10 rounded-lg border border-ink/15 bg-white text-sm">
          {s.logs.map((l, i) => <li key={i} className="flex justify-between gap-3 px-4 py-2"><span><b className="font-medium">{l.actor}</b> {l.action}</span><span className="shrink-0 text-ink/50">{l.created_at}</span></li>)}
          {!s.logs.length && <li className="px-4 py-6 text-ink/60">No activity yet.</li>}
        </ul>
      </div>
    </div>
  );
}
