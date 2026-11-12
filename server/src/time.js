// Small date/time helpers. Dates are 'YYYY-MM-DD' strings, times are 'HH:MM', minutes are minutes since midnight.
export const toMin = (t) => { const [h, m] = String(t).split(':'); return Number(h) * 60 + Number(m); };
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const isHHMM = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
// "Now" is always measured in the office's timezone (default Asia/Manila), whatever timezone the server itself is set to.
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Manila';
const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const parts = (d) => Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
export const localToday = (d = new Date()) => { const p = parts(d); return `${p.year}-${p.month}-${p.day}`; };
export const nowMinutes = (d = new Date()) => { const p = parts(d); return Number(p.hour) * 60 + Number(p.minute); };
export const nowSql = (d = new Date()) => { const p = parts(d); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`; };
export const to12 = (t) => { const [h, m] = String(t).split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
export const addDays = (date, n) => {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekdayOf = (date) => new Date(date + 'T12:00:00Z').getUTCDay(); // 0 = Sunday
