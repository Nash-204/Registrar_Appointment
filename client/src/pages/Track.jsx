import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ShieldCheck, ArrowRight } from 'lucide-react';
import { api, fmtDate, fmtTime } from '../api.js';
import { Checklist } from './Appointment.jsx';
import PageHeader from '../components/PageHeader.jsx';

const STATUS = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-900', text: 'We received your booking. Please arrive 10 minutes early with the documents listed below.' },
  confirmed: { label: 'Confirmed', cls: 'bg-green-100 text-green-900', text: 'Your appointment is confirmed. Please arrive 10 minutes early with the documents listed below.' },
  in_progress: { label: 'In progress', cls: 'bg-blue-100 text-blue-900', text: 'Your appointment is being served now.' },
  completed: { label: 'Completed', cls: 'bg-ink/10 text-ink', text: 'This appointment has been completed. Thank you for visiting the office.' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-900', text: 'This appointment was cancelled.' },
};

export default function Track() {
  const { state } = useLocation();
  const [ref, setRef] = useState(state?.ref || '');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const code = ref.trim();
    if (code.length < 6) { setRes(null); return setErr('Enter the reference code from your confirmation email.'); }
    setBusy(true); setErr(''); setRes(null);
    try { setRes(await api('/track', { method: 'POST', body: { reference_code: code } })); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const s = res && (STATUS[res.status] || STATUS.pending);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <PageHeader eyebrow="Check your booking" title="Track Your Appointment">
        Enter the reference code from your booking confirmation to see its current status.
      </PageHeader>

      <section className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm md:p-8">
          <div className="min-w-[14rem] flex-1">
            <label className="label" htmlFor="ref">Reference code</label>
            <input id="ref" className="input uppercase tracking-wide" maxLength={30} placeholder="e.g. CR-7H2K-9QWX-M4PT" value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" />
          </div>
          <button className="btn btn-primary" disabled={busy}><Search size={16} />{busy ? 'Looking up…' : 'Track'}</button>
        </form>
        {err && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{err}</p>}

        {res && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-deep px-5 py-5 text-white md:px-8">
              <div><p className="text-sm text-white/70">Reference code</p><p className="mt-1 break-all font-serif text-2xl tracking-wide text-seal">{res.reference_code}</p></div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${s.cls}`}>{s.label}</span>
            </div>
            <div className="p-5 md:p-8">
              <dl className="grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-3 text-sm sm:grid-cols-[8rem_1fr]">
                <dt className="text-ink/55">Service</dt><dd className="font-medium">{res.custom_purpose ? `${res.purpose}: ${res.custom_purpose}` : res.purpose}</dd>
                <dt className="text-ink/55">Date</dt><dd className="font-medium">{fmtDate(res.appointment_date)}</dd>
                <dt className="text-ink/55">Time</dt><dd className="font-medium">{fmtTime(res.appointment_time)} (about {res.duration_minutes} minutes)</dd>
              </dl>
              <p className="mt-5 rounded-xl bg-mist p-4 text-sm leading-6 text-ink/75">{s.text}</p>
              {res.status === 'cancelled' && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link to="/appointment" className="btn btn-primary">Book another time <ArrowRight size={17} /></Link>
                  <a href="#contact" className="btn btn-ghost">Contact the office</a>
                </div>
              )}
              {res.checklist.length > 0 && res.status !== 'cancelled' && res.status !== 'completed' && (
                <div className="mt-6 border-t border-ink/10 pt-6">
                  <h2 className="mb-4 text-2xl font-semibold">Documents to bring</h2>
                  <Checklist items={res.checklist} notice={res.notice} />
                </div>
              )}
            </div>
          </div>
        )}
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-ink/55">
          <ShieldCheck size={15} />For privacy, only the booking details above are shown. Lost your code? Contact the office.
        </p>
      </section>
    </div>
  );
}
