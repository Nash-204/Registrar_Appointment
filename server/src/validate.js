// Central input validation. Every value from req.body, req.query and req.params goes through one of these
// before it is used, so wrong types (arrays, objects), oversized or malformed input is rejected with a clear 400.
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (m) => new HttpError(400, m);

export const body = (req) => {
  const b = req.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw bad('Invalid request');
  return b;
};

export function text(v, label, { min = 1, max = 255, optional = false, multiline = false } = {}) {
  if (v === undefined || v === null || v === '') { if (optional) return null; throw bad(`${label} is required`); }
  if (typeof v !== 'string') throw bad(`${label} must be text`);
  let s = v.normalize('NFC');
  s = multiline ? s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ');
  s = s.trim();
  if (!s) { if (optional) return null; throw bad(`${label} is required`); }
  if (s.length < min) throw bad(`${label} is too short`);
  if (s.length > max) throw bad(`${label} is too long (max ${max} characters)`);
  return s;
}

export const name = (v, label = 'Name') => {
  const s = text(v, label, { min: 2, max: 120 });
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u.test(s)) throw bad(`${label} contains characters that are not allowed`);
  return s;
};

export const email = (v, { optional = false } = {}) => {
  const s = text(v, 'Email', { max: 160, optional });
  if (s === null) return null;
  const e = s.toLowerCase();
  if (!/^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[a-z]{2,}$/i.test(e)) throw bad('Enter a valid email address');
  return e;
};

export const PHONE_HELP = 'Enter a Philippine mobile number: 11 digits starting with 09 (like 09171234567), or +63 followed by 10 digits (like +639171234567).';
// Accepts 09XXXXXXXXX or +639XXXXXXXXX (spaces and dashes are ignored) and stores the local 09 format.
export const phone = (v) => {
  const s = text(v, 'Mobile number', { min: 1, max: 30 }).replace(/[\s\-().]/g, '');
  if (/^09\d{9}$/.test(s)) return s;
  if (/^\+639\d{9}$/.test(s)) return '0' + s.slice(3);
  throw bad(PHONE_HELP);
};

export const password = (v) => {
  if (typeof v !== 'string' || v.length < 10 || v.length > 72 || !/[A-Za-z]/.test(v) || !/\d/.test(v))
    throw bad('Password must be 10 to 72 characters and include letters and numbers');
  return v;
};

export const id = (v, label = 'ID') => {
  const n = typeof v === 'string' && /^\d{1,10}$/.test(v) ? Number(v) : v;
  if (!Number.isSafeInteger(n) || n < 1) throw bad(`Invalid ${label}`);
  return n;
};

export const oneOf = (v, list, label) => {
  if (typeof v !== 'string' || !list.includes(v)) throw bad(`Invalid ${label}`);
  return v;
};

export const dateStr = (v, label = 'Date') => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw bad(`${label} must look like 2026-12-31`);
  const d = new Date(v + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw bad(`${label} is not a real date`);
  return v;
};

// Query-string values can arrive as arrays or objects (?a[]=1). Only plain strings are accepted.
export const q = (v, label) => {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw bad(`Invalid ${label}`);
  return v;
};
export const afterId = (v) => (typeof v === 'string' && /^\d{1,10}$/.test(v) ? Number(v) : 0);

export const intIn = (v, label, min, max) => {
  const n = typeof v === 'string' && /^-?\d{1,9}$/.test(v) ? Number(v) : v;
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${label} must be a whole number from ${min} to ${max}`);
  return n;
};
export const timeStr = (v, label = 'Time') => {
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(v)) throw bad(`${label} must be a time like 09:30`);
  return v.slice(0, 5);
};
export const bool = (v, label = 'Value') => {
  if (typeof v !== 'boolean') throw bad(`${label} must be true or false`);
  return v;
};
