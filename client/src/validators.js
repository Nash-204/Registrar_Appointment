// Field checks shared by the booking form and the staff forms. The server repeats every one of them.
export const PHONE_PLACEHOLDER = '09171234567 or +639171234567';
export const PHONE_HELP = 'Enter a Philippine mobile number: 11 digits starting with 09 (like 09171234567), or +63 followed by 10 digits (like +639171234567).';

export function phoneError(v) {
  const s = String(v || '').replace(/[\s\-().]/g, '');
  if (!s) return 'Enter the mobile number.';
  return /^09\d{9}$/.test(s) || /^\+639\d{9}$/.test(s) ? '' : PHONE_HELP;
}

export function emailError(v) {
  const s = String(v || '').trim();
  if (!s) return 'Enter the email address.';
  return /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[a-z]{2,}$/i.test(s) ? '' : 'Enter a valid email address, like juan@example.com.';
}

export function nameError(v, who = 'full name') {
  const s = String(v || '').trim();
  if (s.length < 2) return `Enter the ${who}.`;
  return /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u.test(s) ? '' : `The ${who} can only contain letters, spaces, apostrophes, hyphens and periods.`;
}

const to12 = (m) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`;

// Walk-ins are registered for today only: the arrival time can't be hours ago, and can't be in the future.
export function arrivalError(arrival, now = new Date()) {
  if (!arrival) return '';
  const [h, m] = arrival.split(':').map(Number);
  const a = h * 60 + m, n = now.getHours() * 60 + now.getMinutes();
  if (a < n - 15) return `Arrival time ${to12(a)} has already passed. It is ${to12(n)} now. Enter a time from the last 15 minutes, or leave it empty to use the current time.`;
  if (a > n + 5) return `Arrival time ${to12(a)} is in the future. It is ${to12(n)} now. Leave it empty to use the current time.`;
  return '';
}

// Midnight today, and a date a year ahead, for the block-date calendars.
export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const yearAhead = () => { const d = startOfToday(); d.setDate(d.getDate() + 365); return d; };

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// True when a blocked hour (a 60 minute block starting at `hour`) is already over on `date`.
export const hourPassed = (date, hour, now = new Date()) => {
  if (date !== todayKey(now)) return false;
  const [h, m] = hour.split(':').map(Number);
  return h * 60 + m + 60 <= now.getHours() * 60 + now.getMinutes();
};
