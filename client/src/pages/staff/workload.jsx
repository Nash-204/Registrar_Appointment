import { useCallback, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api, fmtMins, fmtTime } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Badge, Err, StatusActions, usePoll } from './panels.jsx';

const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const LEVEL = {
  overloaded: ['Overloaded', 'bg-red-100 text-red-900', 'bg-red-500'],
  balanced: ['Balanced', 'bg-blue-100 text-blue-900', 'bg-teal'],
  available: ['Has capacity', 'bg-green-100 text-green-900', 'bg-green-500'],
  off: ['Not working', 'bg-ink/10 text-ink/70', 'bg-ink/20'],
};

const Bar = ({ value, level }) => (
  <div className="h-2 overflow-hidden rounded-full bg-ink/10" role="img" aria-label={`Utilization ${value ?? 0} percent`}>
    <div className={`h-full rounded-full ${LEVEL[level][2]}`} style={{ width: `${Math.min(value ?? 0, 100)}%` }} />
  </div>
);

function Tiles({ e }) {
  const items = [
    ['Total assigned', e.total], ['Pending', e.pending], ['Confirmed', e.confirmed], ['In progress', e.in_progress],
    ['Completed', e.completed], ['Cancelled', e.cancelled],
    ['Remaining appointments', e.remaining], ['Est. time remaining', fmtMins(e.remaining_minutes)],
    ['Open time', `${fmtMins(e.open_minutes)} (~${e.open_slots} slots)`], ['Utilization', e.utilization == null ? '–' : `${e.utilization}%`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-5">
      {items.map(([k, v]) => <div key={k} className="border-l-4 border-seal pl-3"><dd className="font-serif text-2xl">{v}</dd><dt className="text-xs text-ink/70">{k}</dt></div>)}
    </dl>
  );
}

export function WorkloadPanel({ admin }) {
  const { user } = useAuth();
  const [date, setDate] = useState(today());
  const [selected, setSelected] = useState(null); // admin: employee id for the detail view
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    // Admin: everyone, or the employee they picked. "My workload": always ask for yourself, even for front desk
    // staff, whose account would otherwise be sent every employee's workload.
    const target = admin ? selected : user?.id;
    const q = new URLSearchParams({ date, ...(target ? { employee_id: String(target) } : {}) });
    try { setData(await api('/workload?' + q)); setErr(''); } catch (e) { setErr(e.message); }
  }, [date, selected, admin, user?.id]);
  usePoll(load, 15000, [load]);
  const act = async (id, body) => { try { await api(`/appointments/${id}`, { method: 'PATCH', body }); load(); } catch (e) { setErr(e.message); } };

  const one = data && data.employees.length === 1 ? data.employees[0] : null;
  const detail = one && (admin ? one.id === selected : one.id === user?.id) ? one : null;
  const list = data && admin && !selected ? [...data.employees].sort((a, b) => (b.utilization ?? -1) - (a.utilization ?? -1)) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="wd">Date</label><input id="wd" type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
        <button className="btn btn-ghost" onClick={() => setDate(today())}>Today</button>
        {admin && selected && <button className="btn btn-ghost" onClick={() => setSelected(null)}><ArrowLeft size={16} />All employees</button>}
      </div>
      <Err msg={err} />
      {!data && !err && <p className="text-sm text-ink/60">Loading…</p>}
      {data?.closed && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">The office is closed on this date.</p>}

      {admin && !selected && data && (
        <>
          <p className="text-sm text-ink/70">
            {data.unassigned > 0 ? <b className="font-semibold text-amber-800">{data.unassigned} appointment(s) still need an employee.</b> : 'Every active appointment has an employee.'}
            {' '}Utilization is booked time divided by working time. Select an employee for their schedule.
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map((e) => {
              const [label, badge] = LEVEL[e.level];
              return (
                <li key={e.id}>
                  <button onClick={() => setSelected(e.id)} className="w-full rounded-xl border border-ink/15 bg-white p-4 text-left hover:shadow-md">
                    <span className="flex items-center justify-between gap-2"><span className="font-medium">{e.name}</span><span className={`rounded px-2 py-0.5 text-xs font-medium ${badge}`}>{label}</span></span>
                    <span className="mt-3 block"><Bar value={e.utilization} level={e.level} /></span>
                    <span className="mt-2 flex flex-wrap justify-between gap-x-4 text-xs text-ink/70">
                      <span>{e.utilization == null ? 'Not working' : `${e.utilization}% booked`}</span>
                      <span>{e.remaining} remaining · ~{fmtMins(e.remaining_minutes)}</span>
                      <span>{fmtMins(e.open_minutes)} open</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {detail && (
        <>
          <div className="flex flex-wrap items-center gap-3"><h3 className="text-2xl">{detail.name}</h3><span className={`rounded px-2 py-0.5 text-xs font-medium ${LEVEL[detail.level][1]}`}>{LEVEL[detail.level][0]}</span></div>
          <div className="max-w-md"><Bar value={detail.utilization} level={detail.level} /></div>
          <Tiles e={detail} />
          <p className="text-xs text-ink/60">Remaining appointments are those not completed or cancelled. Open time is working time not yet booked. Time remaining is an estimate based on each service’s scheduled duration (including time already elapsed on in-progress visits).</p>
          <div className="overflow-x-auto rounded-lg border border-ink/15 bg-white">
            <table className="w-full min-w-[44rem]">
              <thead className="border-b border-ink/10"><tr>{['Time', 'Service', 'Duration', 'Status', 'Reference', 'Client', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink/10">
                {detail.schedule.map((a) => (
                  <tr key={a.id}>
                    <td className="td whitespace-nowrap">{fmtTime(a.time)}{a.end && ` – ${fmtTime(a.end)}`}</td>
                    <td className="td">{a.purpose}{a.custom_purpose && <span className="block text-xs text-ink/60">{a.custom_purpose}</span>} <Badge s={a.source} /></td>
                    <td className="td">{a.duration_minutes} min</td>
                    <td className="td"><Badge s={a.status} /></td>
                    <td className="td whitespace-nowrap text-xs">{a.reference_code}</td>
                    <td className="td">{a.full_name}<span className="block text-xs text-ink/60">{a.phone}</span></td>
                    <td className="td"><div className="flex flex-wrap gap-1"><StatusActions a={a} act={act} /></div></td>
                  </tr>
                ))}
                {!detail.schedule.length && <tr><td className="td text-ink/60" colSpan={7}>No appointments on this date.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
