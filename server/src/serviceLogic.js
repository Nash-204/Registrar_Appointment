// Validation for creating and editing services. Pure (no database), so it can be unit tested.
import { HttpError, body as asBody, text, oneOf, intIn, bool, id } from './validate.js';

export const GROUPS = ['Register', 'Correction', 'Request', 'Other services'];
export const ICONS = ['register', 'correction', 'request', 'late', 'supplemental', 'acknowledgment', 'legitimation', 'out', 'other'];
const DEFAULT_ICON = { Register: 'register', Correction: 'correction', Request: 'request', 'Other services': 'other' };
// The booking forms use this service to ask visitors for a custom reason, so it cannot be renamed or deleted.
export const PROTECTED_SERVICE = 'Others';

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N}\s/&().,'’-]*$/u;
export const serviceName = (v) => {
  const s = text(v, 'Service name', { min: 3, max: 120 });
  if (!NAME_RE.test(s)) throw new HttpError(400, 'The service name can only contain letters, numbers, spaces and / & ( ) . , \' -');
  return s;
};
export const durationMinutes = (v) => {
  const d = intIn(v, 'Duration', 5, 240);
  if (d % 5) throw new HttpError(400, 'Duration must be a multiple of 5 minutes');
  return d;
};

// The longer explanation shown on the About Us page. Paragraphs are separated by a blank line.
export const detailsText = (v) => text(v, 'Detailed description', { max: 2000, optional: true, multiline: true }) || '';

export function parseNewService(raw) {
  const b = asBody({ body: raw });
  const grp = oneOf(b.grp, GROUPS, 'group');
  const employeeIds = b.employee_ids === undefined ? [] : (Array.isArray(b.employee_ids) ? [...new Set(b.employee_ids.map((x) => id(x, 'employee')))] : (() => { throw new HttpError(400, 'Send a list of employees'); })());
  if (employeeIds.length > 200) throw new HttpError(400, 'Too many employees');
  return {
    purpose: serviceName(b.purpose),
    grp,
    icon: b.icon === undefined || b.icon === '' ? DEFAULT_ICON[grp] : oneOf(b.icon, ICONS, 'icon'),
    duration_minutes: durationMinutes(b.duration_minutes),
    summary: text(b.summary, 'Summary', { max: 500, optional: true }) || '',
    note: text(b.note, 'Note', { max: 500, optional: true }) || '',
    details: detailsText(b.details),
    employee_ids: employeeIds,
  };
}

// Only the fields that were sent are returned, each one validated.
export function parseServicePatch(raw) {
  const b = asBody({ body: raw });
  const out = {};
  if (b.purpose !== undefined) out.purpose = serviceName(b.purpose);
  if (b.grp !== undefined) out.grp = oneOf(b.grp, GROUPS, 'group');
  if (b.icon !== undefined) out.icon = oneOf(b.icon, ICONS, 'icon');
  if (b.duration_minutes !== undefined) out.duration_minutes = durationMinutes(b.duration_minutes);
  if (b.is_active !== undefined) out.is_active = bool(b.is_active, 'Active') ? 1 : 0;
  if (b.summary !== undefined) out.summary = text(b.summary, 'Summary', { max: 500, optional: true }) || '';
  if (b.note !== undefined) out.note = text(b.note, 'Note', { max: 500, optional: true }) || '';
  if (b.details !== undefined) out.details = detailsText(b.details);
  if (!Object.keys(out).length) throw new HttpError(400, 'Nothing to update');
  return out;
}
