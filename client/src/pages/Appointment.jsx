import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CalendarCheck, Clock, UserRound, FileText, ArrowLeft, ArrowRight, ShieldCheck, CalendarDays, Mail, Phone, ClipboardList, FileCheck2 } from 'lucide-react';

import { api, fmtDate, fmtTime } from '../api.js';
import { phoneError, emailError, nameError, PHONE_PLACEHOLDER } from '../validators.js';
import Calendar from '../components/Calendar.jsx';
import PageHeader from '../components/PageHeader.jsx';

const STEPS = ['Service', 'Documents', 'Your details', 'Date and time', 'Confirmation'];
const stepIcons = [FileText, ClipboardList, UserRound, CalendarDays, CheckCircle2];
const TITLES = ['What service do you need?', 'Documents to bring', 'Your contact details', 'Choose a date and time'];
const BLURBS = [
  'Select the purpose of your visit to continue.',
  'Review what to bring so your visit goes smoothly.',
  'Provide your information so we can process your appointment.',
  'Choose a preferred date and an available appointment slot.',
];
const GROUP_ORDER = ['Register', 'Correction', 'Request', 'Other services'];
const REASONS = {
  closed: 'The office is closed on that day. Please pick another date.',
  limit: 'Online appointments are fully booked for that day. Please pick another date.',
  capacity: 'Online appointments are fully booked for that day. Please pick another date.',
  full: 'No time is left on that day for this service. Please pick another date.',
  no_staff: 'No staff member is available for this service on that day. Please pick another date.',
};

// Shared with the tracking page: mandatory and conditional documents, plus the notice.
export function Checklist({ items, notice }) {
  const must = items.filter((r) => r.kind === 'mandatory');
  const maybe = items.filter((r) => r.kind === 'conditional');
  return (
    <div className="space-y-5">
      {must.length > 0 && (
        <div>
          <h3 className="font-serif text-lg font-semibold">You must bring</h3>
          <ul className="mt-3 space-y-2">
            {must.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-ink/10 bg-white p-3 text-sm">
                <FileCheck2 size={18} className="mt-0.5 shrink-0 text-teal" />
                <span>{r.label}{r.detail && <span className="block text-xs text-ink/60">{r.detail}</span>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {maybe.length > 0 && (
        <div>
          <h3 className="font-serif text-lg font-semibold">Depending on your situation</h3>
          <ul className="mt-3 space-y-2">
            {maybe.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-dashed border-ink/20 bg-paper p-3 text-sm">
                <span className="mt-0.5 w-[18px] shrink-0 text-center font-semibold text-ink/40">+</span>
                <span>{r.label}{r.detail && <span className="block text-xs text-ink/60">{r.detail}</span>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!items.length && <p className="text-sm text-ink/70">No documents are listed for this service yet. Bring a valid ID and ask our staff.</p>}
      {notice && (
        <div className="flex items-start gap-3 rounded-xl bg-mist p-4">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-teal" />
          <p className="text-sm leading-6 text-ink/75">{notice}</p>
        </div>
      )}
    </div>
  );
}

export default function Appointment() {
  const [params] = useSearchParams();
  const [services, setServices] = useState(null);
  const [info, setInfo] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ service_id: null, custom_purpose: '', full_name: '', email: '', phone: '', appointment_date: '', appointment_hour: '', ack: false });
  const [slots, setSlots] = useState(null);
  const [slotsBusy, setSlotsBusy] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  // Email verification: idle -> sent (code emailed) -> verified (token received)
  const [otp, setOtp] = useState({ stage: 'idle', code: '', token: '', email: '', cooldown: 0, busy: false });
  const resetOtp = () => setOtp({ stage: 'idle', code: '', token: '', email: '', cooldown: 0, busy: false });
  useEffect(() => {
    if (otp.cooldown <= 0) return undefined;
    const t = setTimeout(() => setOtp((o) => ({ ...o, cooldown: o.cooldown - 1 })), 1000);
    return () => clearTimeout(t);
  }, [otp.cooldown]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([api('/services'), api('/settings/public')]).then(([s, i]) => {
      setServices(s); setInfo(i);
      const want = s.find((x) => x.purpose === params.get('purpose'));
      if (want) setF((p) => ({ ...p, service_id: want.id }));
    }).catch((e) => setLoadErr(e.message));
  }, []);

  const service = useMemo(() => services?.find((s) => s.id === f.service_id) || null, [services, f.service_id]);
  const grouped = useMemo(() => GROUP_ORDER.map((g) => [g, (services || []).filter((s) => s.grp === g)]).filter(([, l]) => l.length), [services]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const min = new Date(today); if (!info?.same_day_open) min.setDate(min.getDate() + 1);
  const max = new Date(today); max.setDate(max.getDate() + (info?.max_days_ahead || 60));

  useEffect(() => {
    if (!f.appointment_date || !f.service_id) return;
    let live = true;
    setSlots(null); setSlotsBusy(true); set('appointment_hour', ''); setErr('');
    api(`/appointments/slots?date=${f.appointment_date}&service_id=${f.service_id}`)
      .then((d) => live && setSlots(d)).catch((e) => live && setErr(e.message)).finally(() => live && setSlotsBusy(false));
    return () => { live = false; };
  }, [f.appointment_date, f.service_id]);

  const next = () => {
    setErr('');
    if (step === 0) {
      if (!service) return setErr('Choose a service');
      if (service.purpose === 'Others' && f.custom_purpose.trim().length < 3) return setErr('Tell us your purpose');
    }
    if (step === 1 && !f.ack) return setErr('Please confirm that you have read the document checklist');
    if (step === 2) {
      const problem = nameError(f.full_name) || emailError(f.email) || phoneError(f.phone);
      if (problem) return setErr(problem);
      if (otp.stage === 'verified' && otp.email === f.email.trim().toLowerCase()) return setStep(3);
      return sendCode();
    }
    setStep(step + 1);
  };

  const sendCode = async () => {
    setErr(''); setOtp((o) => ({ ...o, busy: true }));
    try {
      const d = await api('/verify/request', { method: 'POST', body: { email: f.email.trim() } });
      setOtp({ stage: 'sent', code: '', token: '', email: f.email.trim().toLowerCase(), cooldown: d.resend_in || 60, busy: false });
    } catch (e) { setErr(e.message); setOtp((o) => ({ ...o, busy: false })); }
  };

  const verifyCode = async () => {
    setErr(''); setOtp((o) => ({ ...o, busy: true }));
    try {
      const d = await api('/verify/confirm', { method: 'POST', body: { email: otp.email, code: otp.code } });
      setOtp((o) => ({ ...o, stage: 'verified', token: d.verification_token, busy: false }));
      setStep(3);
    } catch (e) { setErr(e.message); setOtp((o) => ({ ...o, busy: false, code: '' })); }
  };

  const submit = async () => {
    if (!f.appointment_date || !f.appointment_hour) return setErr('Pick a date and an hour');
    setBusy(true); setErr('');
    try {
      setDone(await api('/appointments', { method: 'POST', body: {
        service_id: f.service_id, custom_purpose: service.purpose === 'Others' ? f.custom_purpose : undefined,
        full_name: f.full_name, email: f.email, phone: f.phone,
        appointment_date: f.appointment_date, appointment_hour: f.appointment_hour, acknowledged: f.ack, verification_token: otp.token } }));
      setStep(4);
    } catch (e) {
      setErr(e.message);
      if (/verify/i.test(e.message)) { resetOtp(); setStep(2); return; } // the verification expired or was already used
      if (f.appointment_date) api(`/appointments/slots?date=${f.appointment_date}&service_id=${f.service_id}`).then(setSlots).catch(() => {}); // refresh what is really left
      set('appointment_hour', '');
    } finally { setBusy(false); }
  };

  const hours = slots?.hours || [];
  const morning = hours.filter((h) => h.hour < '12:00');
  const afternoon = hours.filter((h) => h.hour >= '12:00');
  const hourGroup = (label, list) => list.length ? (
    <div key={label}>
      <p className="mb-3 text-sm font-medium text-ink/65">{label}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {list.map(({ hour, left }) => {
          const selected = f.appointment_hour === hour;
          const full = left < 1;
          return (
            <button key={hour} type="button" disabled={full} onClick={() => set('appointment_hour', hour)} aria-pressed={selected}
              className={`rounded-xl border px-3 py-3 text-center transition-colors ${selected ? 'border-teal bg-teal text-white' : full ? 'cursor-not-allowed border-ink/10 bg-mist text-ink/40' : 'border-ink/15 bg-white text-ink hover:border-seal hover:bg-paper'}`}>
              <span className="block text-base font-semibold">{fmtTime(hour)}</span>
              <span className={`mt-1 block text-xs ${selected ? 'text-white/85' : full ? 'text-ink/40' : 'text-ink/60'}`}>{full ? 'Full' : `${left} slot${left === 1 ? '' : 's'} left`}</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  const inputWithIcon = (Icon, id, label, props) => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative mt-2">
        <Icon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
        <input id={id} className="input !mt-0 !pl-10 disabled:bg-mist disabled:text-ink/60" {...props} />
      </div>
    </div>
  );

  if (loadErr || !services) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <PageHeader eyebrow="Convenient and accessible service" title="Book an Appointment" />
        <section className="mx-auto max-w-5xl px-4 py-12">
          {loadErr ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadErr}</p> : <p className="text-ink/60">Loading…</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <PageHeader eyebrow="Convenient and accessible service" title="Book an Appointment">
        Schedule your visit to the Civil Registry Office. Complete the steps below to choose your service, review the documents to bring, provide your details, and reserve an available time.
      </PageHeader>

      <section className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
          {/* Progress */}
          <div className="border-b border-ink/10 bg-white px-5 py-6 md:px-8">
            <ol className="grid grid-cols-5 gap-2" aria-label="Appointment progress">
              {STEPS.map((s, i) => {
                const Icon = stepIcons[i];
                const active = i === step;
                const completed = i < step;
                return (
                  <li key={s} aria-current={active ? 'step' : undefined} className="min-w-0">
                    <div className={`mb-3 h-1 rounded-full ${i <= step ? 'bg-seal' : 'bg-ink/10'}`} />
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${active ? 'bg-navy-deep text-white' : completed ? 'bg-seal text-ink' : 'bg-mist text-ink/50'}`}>
                        {completed ? <CheckCircle2 size={19} /> : <Icon size={18} />}
                      </span>
                      <span className={`text-xs sm:text-sm ${active ? 'font-bold text-ink' : completed ? 'font-medium text-ink/80' : 'text-ink/50'}`}>{s}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="p-5 md:p-8">
            {step < 4 && (
              <div className="mb-7">
                <p className="text-sm font-semibold text-sealdark">STEP {step + 1} OF 5</p>
                <h2 className="mt-2 text-2xl font-semibold md:text-3xl">{TITLES[step]}</h2>
                <p className="mt-2 text-sm leading-6 text-ink/60">{BLURBS[step]}</p>
              </div>
            )}

            {/* Step 1: Service */}
            {step === 0 && (
              <div className="space-y-6">
                {grouped.map(([g, list]) => (
                  <fieldset key={g}>
                    <legend className="mb-3 font-serif text-lg font-semibold">{g}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {list.map((s) => {
                        const selected = f.service_id === s.id;
                        return (
                          <label key={s.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 text-sm transition-colors ${selected ? 'border-teal bg-teal/10 ring-1 ring-teal/20' : 'border-ink/10 bg-white hover:border-seal hover:bg-paper'}`}>
                            <span className="flex items-center gap-3">
                              <input type="radio" name="service" checked={selected} onChange={() => set('service_id', s.id)} className="h-4 w-4 accent-[#1C3F78]" />
                              <span className={`font-medium ${selected ? 'text-ink' : 'text-ink/80'}`}>{s.purpose}</span>
                            </span>
                            <span className="shrink-0 text-xs text-ink/50">~{s.duration_minutes} min</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
                {service?.purpose === 'Others' && (
                  <div>
                    <label className="label" htmlFor="cp">Please specify your purpose</label>
                    <input id="cp" className="input" maxLength={255} placeholder="e.g. Certified copy of an annotated record" value={f.custom_purpose} onChange={(e) => set('custom_purpose', e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Documents */}
            {step === 1 && service && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-paper p-4">
                  <p className="font-semibold">{service.purpose}</p>
                  <p className="flex items-center gap-2 text-sm text-ink/60"><Clock size={16} />About {service.duration_minutes} minutes</p>
                </div>
                <Checklist items={service.requirements} notice={info?.checklist_notice} />
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition-colors ${f.ack ? 'border-teal bg-teal/10' : 'border-ink/15 bg-white'}`}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1C3F78]" checked={f.ack} onChange={(e) => set('ack', e.target.checked)} />
                  <span>I have read the document checklist and understand that staff may ask for additional documents.</span>
                </label>
              </div>
            )}

            {/* Step 3: Contact details and email verification */}
            {step === 2 && (
              <div className="space-y-5">
                {inputWithIcon(UserRound, 'fn', 'Full name', { maxLength: 120, placeholder: 'Juan Dela Cruz', value: f.full_name, onChange: (e) => set('full_name', e.target.value), autoComplete: 'name', disabled: otp.stage === 'sent' })}
                {inputWithIcon(Mail, 'em', 'Email address', { type: 'email', maxLength: 160, placeholder: 'juan@example.com', value: f.email, onChange: (e) => { set('email', e.target.value); if (otp.stage === 'verified' && e.target.value.trim().toLowerCase() !== otp.email) resetOtp(); }, autoComplete: 'email', disabled: otp.stage === 'sent' })}
                {inputWithIcon(Phone, 'ph', 'Mobile number', { type: 'tel', inputMode: 'tel', maxLength: 16, placeholder: PHONE_PLACEHOLDER, value: f.phone, onChange: (e) => set('phone', e.target.value), autoComplete: 'tel', disabled: otp.stage === 'sent' })}
                <p className="-mt-3 text-xs text-ink/55">Philippine mobile numbers only: 11 digits starting with 09, or +63 followed by your number.</p>

                {otp.stage === 'idle' && (
                  <div className="flex items-start gap-3 rounded-xl bg-mist p-4">
                    <ShieldCheck size={20} className="mt-0.5 shrink-0 text-teal" />
                    <p className="text-sm leading-6 text-ink/70">We will email you a 6-digit code to confirm your email address before you choose a time.</p>
                  </div>
                )}

                {otp.stage === 'sent' && (
                  <div className="rounded-xl border border-seal/60 bg-paper p-4 md:p-5">
                    <div className="flex items-start gap-3">
                      <ShieldCheck size={22} className="mt-0.5 shrink-0 text-teal" />
                      <div>
                        <h3 className="font-semibold">Verify your email</h3>
                        <p className="mt-1 text-sm leading-6 text-ink/70">We sent a 6-digit code to <b className="break-all font-semibold">{otp.email}</b>. It expires in 10 minutes. Check your spam folder if you can’t find it.</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <div className="w-48">
                        <label className="label" htmlFor="otp">Verification code</label>
                        <input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="input text-center text-xl tracking-[0.35em]"
                          value={otp.code} onChange={(e) => setOtp((o) => ({ ...o, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                          onKeyDown={(e) => { if (e.key === 'Enter' && otp.code.length === 6 && !otp.busy) { e.preventDefault(); verifyCode(); } }} />
                      </div>
                      <button type="button" className="btn btn-primary" disabled={otp.busy || otp.code.length !== 6} onClick={verifyCode}>{otp.busy ? 'Checking…' : 'Verify'}</button>
                      <button type="button" className="btn btn-ghost" disabled={otp.busy || otp.cooldown > 0} onClick={sendCode}>{otp.cooldown > 0 ? `Resend in ${otp.cooldown}s` : 'Resend code'}</button>
                    </div>
                    <button type="button" className="mt-3 text-sm text-teal underline" onClick={resetOtp}>Use a different email or change my details</button>
                  </div>
                )}

                {otp.stage === 'verified' && (
                  <p className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-900"><CheckCircle2 size={18} className="shrink-0" />Email verified: <b className="break-all font-semibold">{otp.email}</b></p>
                )}
              </div>
            )}

            {/* Step 4: Date and time */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="min-w-0 rounded-xl border border-ink/10 bg-paper p-3 sm:p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-seal text-ink"><CalendarDays size={20} /></span>
                    <div>
                      <h3 className="font-semibold">Select your date</h3>
                      <p className="text-sm text-ink/60">
                        {service?.purpose}, about {service?.duration_minutes} minutes. Appointments run {info ? `${fmtTime(info.booking_start)} to ${fmtTime(info.booking_end)}` : ''}, Monday to Friday.
                      </p>
                    </div>
                  </div>
                  <Calendar value={f.appointment_date} onChange={(d) => set('appointment_date', d)} min={min} max={max} />
                  {f.appointment_date && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-seal/50 bg-white p-3 text-sm">
                      <CheckCircle2 size={18} className="shrink-0 text-teal" />
                      <span>Selected date: <b className="font-semibold">{fmtDate(f.appointment_date)}</b></span>
                    </div>
                  )}
                </div>

                {f.appointment_date && (
                  <div className="rounded-xl border border-ink/10 p-4 md:p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-seal text-ink"><Clock size={20} /></span>
                      <div>
                        <h3 className="font-semibold">Choose an hour</h3>
                        <p className="text-sm text-ink/60">Pick an hour with slots left. We assign your exact start time within that hour and show it on your confirmation.</p>
                      </div>
                    </div>
                    {slotsBusy && <p className="rounded-lg bg-mist p-3 text-sm text-ink/70">Checking available hours…</p>}
                    {slots && !slots.reason && <div className="space-y-5">{hourGroup('Morning', morning)}{hourGroup('Afternoon', afternoon)}</div>}
                    {slots?.reason && <p className="rounded-lg bg-mist p-3 text-sm text-ink/70">{REASONS[slots.reason] || 'No hours are available on this day. Please pick another date.'}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Confirmation */}
            {step === 4 && done && (
              <div className="py-4">
                <div className="mx-auto max-w-xl text-center">
                  <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-teal/10"><CheckCircle2 size={46} className="text-teal" /></span>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-sealdark">Booking successful</p>
                  <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Your appointment is booked!</h2>
                  <p className="mt-3 leading-7 text-ink/65">Keep your reference code private and bring a valid ID and the documents listed below.</p>
                </div>

                <div className="mx-auto mt-8 max-w-xl overflow-hidden rounded-2xl border border-ink/10">
                  <div className="bg-navy-deep px-5 py-5 text-center text-white">
                    <p className="text-sm text-white/70">Reference code</p>
                    <p className="mt-2 break-all font-serif text-3xl tracking-wide text-seal">{done.reference_code}</p>
                  </div>
                  <dl className="grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-4 p-5 text-sm sm:grid-cols-[8rem_1fr] md:p-6">
                    <dt className="text-ink/55">Service</dt>
                    <dd className="font-medium">{done.custom_purpose ? `${done.purpose}: ${done.custom_purpose}` : done.purpose}</dd>
                    <dt className="text-ink/55">Date</dt><dd className="font-medium">{fmtDate(done.appointment_date)}</dd>
                    <dt className="text-ink/55">Time</dt><dd className="font-medium">{fmtTime(done.appointment_time)} to {fmtTime(done.end_time)}</dd>
                    <dt className="text-ink/55">Name</dt><dd className="break-words font-medium">{done.full_name}</dd>
                  </dl>
                </div>

                <div className="mx-auto mt-5 max-w-xl rounded-xl bg-mist p-4 text-sm leading-6 text-ink/75">
                  {done.emailed ? `A confirmation with this checklist was sent to ${done.email}.` : 'We could not send the confirmation email. Please save your reference code and the checklist below.'}
                </div>

                <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-ink/10 p-5 md:p-6">
                  <h3 className="mb-4 text-2xl font-semibold">Documents to bring</h3>
                  <Checklist items={done.checklist} notice={done.notice} />
                </div>

                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Link to="/track" state={{ ref: done.reference_code }} className="btn btn-primary">Track this appointment <ArrowRight size={17} /></Link>
                  <Link to="/" className="btn btn-ghost">Back to home</Link>
                </div>
              </div>
            )}

            {err && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{err}</p>}

            {step < 4 && (
              <div className="mt-8 flex items-center justify-between gap-3 border-t border-ink/10 pt-6">
                <button type="button" className="btn btn-ghost" disabled={step === 0} onClick={() => { setErr(''); setStep(step - 1); }}>
                  <ArrowLeft size={17} />Back
                </button>
                {step < 3 ? (
                  step === 2 && otp.stage === 'sent' ? <span /> : ( // while a code is out, the Verify button above is the next action
                    <button type="button" className="btn btn-primary" disabled={otp.busy} onClick={next}>
                      {step === 2 && otp.stage !== 'verified' ? (otp.busy ? 'Sending code…' : 'Send verification code') : 'Continue'}<ArrowRight size={17} />
                    </button>
                  )
                ) : (
                  <button type="button" className="btn btn-primary" disabled={busy || !f.appointment_hour} onClick={submit}>
                    {busy ? 'Booking…' : 'Confirm booking'}{!busy && <CalendarCheck size={17} />}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-ink/55">
          <ShieldCheck size={15} />Please review your details before confirming your appointment.
        </p>
      </section>
    </div>
  );
}
