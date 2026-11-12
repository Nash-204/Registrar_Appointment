// Office settings: defaults, parsing from the database, and strict validation of admin changes. No database access here.
import { HttpError, intIn, timeStr, bool, text } from './validate.js';
import { toMin } from './time.js';

export const DEFAULTS = {
  office_open: '08:00', office_close: '17:00',
  booking_start: '09:00', booking_end: '16:00',
  buffer_minutes: 5, slot_step_minutes: 10,
  daily_online_limit: 0, // 0 = automatic: capacity comes from the staff assigned to each service
  walkin_enabled: true, walkin_reserve_percent: 20,
  walkin_release: 'never', walkin_release_time: '14:00',
  max_days_ahead: 60,
  checklist_notice: 'Requirements may depend on your circumstances and the applicable civil registry rules. This list is a guide. Our staff will confirm exactly what you need, and may ask for additional documents.',
};

export function parseSettings(rows) {
  const s = { ...DEFAULTS };
  for (const { k, v } of rows) {
    if (!(k in DEFAULTS)) continue;
    const d = DEFAULTS[k];
    s[k] = typeof d === 'number' ? Number(v) : typeof d === 'boolean' ? v === '1' || v === 'true' : String(v);
  }
  return s;
}

export function validateSettingsUpdate(body, current) {
  const next = { ...current };
  const changed = {};
  const set = (k, v) => { next[k] = v; changed[k] = v; };
  for (const k of Object.keys(body)) {
    if (!(k in DEFAULTS)) throw new HttpError(400, `Unknown setting: ${k}`);
    const v = body[k];
    switch (k) {
      case 'office_open': case 'office_close': case 'booking_start': case 'booking_end': case 'walkin_release_time':
        set(k, timeStr(v, k)); break;
      case 'buffer_minutes': set(k, intIn(v, 'Buffer', 5, 10)); break;
      case 'slot_step_minutes': {
        const n = intIn(v, 'Slot step', 5, 30);
        if (![5, 10, 15, 20, 30].includes(n)) throw new HttpError(400, 'Slot step must be 5, 10, 15, 20 or 30 minutes');
        set(k, n); break;
      }
      case 'daily_online_limit': set(k, intIn(v, 'Daily online limit', 0, 500)); break;
      case 'walkin_enabled': set(k, bool(v, 'Walk-in reserve switch')); break;
      case 'walkin_reserve_percent': set(k, intIn(v, 'Walk-in reserve', 0, 60)); break;
      case 'walkin_release':
        if (!['never', 'same_day_time'].includes(v)) throw new HttpError(400, 'Invalid release policy');
        set(k, v); break;
      case 'max_days_ahead': set(k, intIn(v, 'Days ahead', 1, 180)); break;
      case 'checklist_notice': set(k, text(v, 'Checklist notice', { min: 10, max: 600, multiline: true })); break;
      default: break;
    }
  }
  const oo = toMin(next.office_open), oc = toMin(next.office_close), bs = toMin(next.booking_start), be = toMin(next.booking_end);
  if (oo >= oc) throw new HttpError(400, 'Office closing time must be after opening time');
  if (bs >= be) throw new HttpError(400, 'Booking end time must be after booking start time');
  if (bs < oo || be > oc) throw new HttpError(400, 'Booking hours must fall inside office hours');
  const rt = toMin(next.walkin_release_time);
  if (rt < bs || rt >= be) throw new HttpError(400, 'Release time must fall inside the booking hours');
  return { next, changed };
}

export const serialize = (v) => (typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
