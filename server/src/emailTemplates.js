// HTML + plain-text email bodies. Tables and inline styles only, because email apps ignore most modern CSS.
// Every value that came from a visitor is escaped before it goes into HTML.
const C = { navy: '#081A3A', ink: '#0E2147', gold: '#F0B13A', goldDark: '#8A5F0C', mist: '#EEF2F8', paper: '#F7F9FC', blue: '#1C3F78', line: '#DDE3EC', muted: '#5B6678' };
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Arial,Helvetica,sans-serif";

export const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const to12 = (t) => { const [h, m] = String(t).slice(0, 5).split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
export const longDate = (d) => new Date(String(d).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

const office = () => ({
  name: process.env.OFFICE_NAME || 'Municipal Civil Registry Office',
  place: process.env.OFFICE_LOCATION || 'Laoag City, Ilocos Norte',
  phone: process.env.OFFICE_PHONE || '',
  email: process.env.OFFICE_EMAIL || '',
  logo: process.env.EMAIL_LOGO_URL || '',
  origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, ''),
});

function shell({ title, preheader, inner }) {
  const o = office();
  const mark = o.logo
    ? `<img src="${esc(o.logo)}" width="46" height="46" alt="" style="display:block;border-radius:23px;border:0">`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="46" height="46" align="center" valign="middle" style="width:46px;height:46px;border-radius:23px;background:${C.gold};font:bold 17px ${SERIF};color:${C.navy}">CR</td></tr></table>`;
  const contact = [o.phone && `Phone: ${esc(o.phone)}`, o.email && `Email: ${esc(o.email)}`].filter(Boolean).join(' &nbsp;&middot;&nbsp; ');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper}">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
    <tr><td style="background:${C.navy};border-top:4px solid ${C.gold};border-radius:12px 12px 0 0;padding:22px 28px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle" style="padding-right:14px">${mark}</td>
        <td valign="middle"><div style="font:bold 20px ${SERIF};color:#ffffff;line-height:1.25">${esc(o.name)}</div>
          <div style="font:12px ${SANS};color:${C.gold};letter-spacing:.5px;margin-top:3px">${esc(o.place)}</div></td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#ffffff;padding:32px 28px;border-left:1px solid ${C.line};border-right:1px solid ${C.line};font:15px/1.6 ${SANS};color:${C.ink}">${inner}</td></tr>
    <tr><td style="background:${C.mist};border:1px solid ${C.line};border-top:0;border-radius:0 0 12px 12px;padding:18px 28px;font:12px/1.6 ${SANS};color:${C.muted}">
      <div style="font-weight:bold;color:${C.ink}">${esc(o.name)}</div>
      <div>Office hours: Monday to Friday, 8:00 AM to 5:00 PM${contact ? `<br>${contact}` : ''}</div>
      <div style="margin-top:8px">This is an automated message. Please do not reply to this email.</div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const heading = (text) => `<h1 style="margin:0 0 12px;font:bold 24px/1.3 ${SERIF};color:${C.ink}">${text}</h1>`;
const para = (html, extra = '') => `<p style="margin:0 0 16px;${extra}">${html}</p>`;
const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px"><tr><td style="background:${C.blue};border-radius:8px"><a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font:bold 15px ${SANS};color:#ffffff;text-decoration:none">${esc(label)}</a></td></tr></table>`;
const notice = (html) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0"><tr><td style="background:${C.mist};border-left:4px solid ${C.gold};border-radius:6px;padding:14px 16px;font:13px/1.6 ${SANS};color:${C.ink}">${html}</td></tr></table>`;

/* ---------- Verification code ---------- */
export function otpEmail(code, minutes) {
  const inner = [
    heading('Verify your email address'),
    para('Use this code to confirm your email address and continue booking your appointment.'),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px"><tr><td align="center" style="background:${C.mist};border:2px dashed ${C.gold};border-radius:10px;padding:22px 12px">
      <div style="font:12px ${SANS};color:${C.muted};text-transform:uppercase;letter-spacing:2px">Your verification code</div>
      <div style="font:bold 38px ${SERIF};letter-spacing:10px;color:${C.navy};margin-top:8px;padding-left:10px">${esc(code)}</div>
    </td></tr></table>`,
    para(`This code expires in <b>${esc(minutes)} minutes</b> and can be used once.`),
    notice(`<b>Keep it private.</b> Our staff will never ask you for this code. If you did not try to book an appointment, you can safely ignore this email.`),
  ].join('');
  const text = [
    'Verify your email address', '',
    'Use this code to confirm your email address and continue booking your appointment:', '',
    `    ${code}`, '',
    `It expires in ${minutes} minutes and can be used once.`,
    'Never share it. Our staff will never ask you for it.',
    'If you did not try to book an appointment, you can ignore this email.',
  ].join('\n');
  return { subject: `Your verification code: ${code}`, html: shell({ title: 'Verify your email address', preheader: `Your code is ${code}. It expires in ${minutes} minutes.`, inner }), text };
}

/* ---------- Booking confirmation ---------- */
const row = (label, value) => `<tr><td valign="top" style="padding:9px 0;border-bottom:1px solid ${C.line};width:34%;font:13px ${SANS};color:${C.muted}">${label}</td><td valign="top" style="padding:9px 0;border-bottom:1px solid ${C.line};font:bold 14px ${SANS};color:${C.ink}">${value}</td></tr>`;
const list = (items, mark, color) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.map((r) =>
  `<tr><td width="24" valign="top" style="padding:5px 0;font:bold 15px ${SANS};color:${color}">${mark}</td><td valign="top" style="padding:5px 0;font:14px/1.5 ${SANS};color:${C.ink}">${esc(r.label)}${r.detail ? `<div style="font-size:12px;color:${C.muted}">${esc(r.detail)}</div>` : ''}</td></tr>`).join('')}</table>`;

export function bookingEmail(a) {
  const o = office();
  const service = a.custom_purpose ? `${a.purpose}: ${a.custom_purpose}` : a.purpose;
  const must = (a.checklist || []).filter((r) => r.kind === 'mandatory');
  const maybe = (a.checklist || []).filter((r) => r.kind === 'conditional');
  const when = `${to12(a.appointment_time)}${a.end_time ? ` to ${to12(a.end_time)}` : ''}`;
  const trackUrl = `${o.origin}/track`;

  const inner = [
    heading('Your appointment is booked'),
    para(`Hello <b>${esc(a.full_name)}</b>, your visit to the Civil Registry Office is confirmed. Please keep this email for your records.`),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px"><tr><td align="center" style="background:${C.navy};border-radius:10px;padding:20px 12px">
      <div style="font:12px ${SANS};color:#B8C2D6;text-transform:uppercase;letter-spacing:2px">Reference code</div>
      <div style="font:bold 26px ${SERIF};letter-spacing:2px;color:${C.gold};margin-top:6px">${esc(a.reference_code)}</div>
    </td></tr></table>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px">
      ${row('Service', esc(service))}${row('Date', esc(longDate(a.appointment_date)))}${row('Time', esc(when))}
      ${a.duration_minutes ? row('Visit length', `About ${esc(a.duration_minutes)} minutes`) : ''}${row('Name', esc(a.full_name))}${row('Mobile number', esc(a.phone))}
    </table>`,
    must.length ? `<h2 style="margin:26px 0 8px;font:bold 18px ${SERIF};color:${C.ink}">Please bring</h2>${list(must, '&#10003;', C.goldDark)}` : '',
    maybe.length ? `<h2 style="margin:22px 0 8px;font:bold 18px ${SERIF};color:${C.ink}">You may also need</h2>${list(maybe, '+', C.muted)}` : '',
    a.notice ? notice(esc(a.notice)) : '',
    notice(`<b>On the day:</b> arrive 10 minutes early, bring a valid ID, and quote your reference code at the counter. <b>Keep your reference code private.</b> Anyone who has it can look up this booking.`),
    `<div style="margin-top:22px">${para('Need to check your booking later?', 'margin-bottom:6px')}${button(trackUrl, 'Track your appointment')}</div>`,
  ].join('');

  const text = [
    `Hello ${a.full_name},`, '',
    'Your appointment with the Civil Registry Office is booked.', '',
    `Reference code: ${a.reference_code}`,
    `Service: ${service}`,
    `Date: ${longDate(a.appointment_date)}`,
    `Time: ${when}${a.duration_minutes ? ` (about ${a.duration_minutes} minutes)` : ''}`,
    `Mobile number: ${a.phone}`, '',
    ...(must.length ? ['Please bring:', ...must.map((r) => `  - ${r.label}`), ''] : []),
    ...(maybe.length ? ['You may also need:', ...maybe.map((r) => `  - ${r.label}`), ''] : []),
    ...(a.notice ? [a.notice, ''] : []),
    'Arrive 10 minutes early and bring a valid ID.',
    `Check your appointment status any time: ${trackUrl}`,
    'Keep your reference code private. It is needed to track your booking.',
  ].join('\n');

  return { subject: `Appointment confirmed: ${a.reference_code}`, html: shell({ title: 'Your appointment is booked', preheader: `${longDate(a.appointment_date)} at ${to12(a.appointment_time)}. Reference ${a.reference_code}.`, inner }), text };
}
