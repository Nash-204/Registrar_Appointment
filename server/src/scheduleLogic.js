// Pure scheduling rules (no database). Everything is in minutes since midnight so it can be unit tested.
import crypto from 'crypto';
import { toMin, hhmm, isHHMM, addDays, weekdayOf, localToday, nowMinutes, to12 } from './time.js';

/* ---------- Reference codes: 60 bits of randomness, no ambiguous characters ---------- */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 symbols, so a byte maps evenly
export function newReference() {
  const b = crypto.randomBytes(12);
  let s = '';
  for (let i = 0; i < 12; i++) s += ALPHABET[b[i] % 32];
  return `CR-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

/* ---------- Building a day from database rows ---------- */
const toAppt = (a) => ({ id: a.id, handled_by: a.handled_by, source: a.source, status: a.status, s: toMin(a.t), dur: a.dur, buf: a.buf });

export function buildDay({ date, employees, schedules, quals, blockedDates, blockedSlots, appts }) {
  const closed = blockedDates.some((b) => b.employee_id == null);
  const emps = employees.map((e) => {
    const sc = schedules.find((s) => s.employee_id === e.id);
    return {
      id: e.id, name: e.name,
      sched: sc ? {
        working: !!sc.is_working, start: toMin(sc.start_time), end: toMin(sc.end_time),
        ls: sc.lunch_start ? toMin(sc.lunch_start) : null, le: sc.lunch_end ? toMin(sc.lunch_end) : null,
      } : null,
      quals: new Set(quals.filter((q) => q.employee_id === e.id).map((q) => q.service_id)),
      dayBlocked: blockedDates.some((b) => b.employee_id === e.id),
      blocks: blockedSlots.filter((b) => b.employee_id === e.id).map((b) => [toMin(b.t), toMin(b.t) + 60]),
      appts: appts.filter((a) => a.handled_by === e.id).map(toAppt),
    };
  });
  return { date, closed, emps, appts: appts.map(toAppt) };
}

/* ---------- Intervals ---------- */
const subtract = (ivs, [bs, be]) => {
  const out = [];
  for (const [s, e] of ivs) {
    if (be <= s || bs >= e) { out.push([s, e]); continue; }
    if (bs > s) out.push([s, bs]);
    if (be < e) out.push([be, e]);
  }
  return out;
};

// The stretches of the day an employee is actually working inside a window (schedule minus lunch).
export function workIntervals(emp, closed, win) {
  const sc = emp.sched;
  if (closed || !sc || !sc.working || emp.dayBlocked) return [];
  let iv = [[Math.max(sc.start, win.start), Math.min(sc.end, win.end)]];
  if (sc.ls != null && sc.le != null && sc.le > sc.ls) iv = subtract(iv, [sc.ls, sc.le]);
  return iv.filter(([a, b]) => b > a);
}

// Total free minutes of an employee in a window: working time minus blocked slots (appointments are not subtracted).
export function freeMinutes(emp, closed, win) {
  let iv = workIntervals(emp, closed, win);
  for (const b of emp.blocks) iv = subtract(iv, b);
  return iv.reduce((n, [a, b]) => n + (b - a), 0);
}

// Can this employee take [s, s+dur) plus a trailing buffer without overlapping anything?
export function canFit(emp, closed, win, s, dur, buf, ignoreId = null) {
  const e = s + dur;
  if (!workIntervals(emp, closed, win).some(([a, b]) => s >= a && e <= b)) return false; // outside hours or across lunch
  if (emp.blocks.some(([bs, be]) => s < be && e > bs)) return false;                     // blocked slot
  return !emp.appts.some((a) => a.id !== ignoreId && s < a.s + a.dur + a.buf && e + buf > a.s); // overlap incl. buffers
}

export const officeWindow = (st) => ({ start: toMin(st.office_open), end: toMin(st.office_close) });
export const bookingWindow = (st) => ({ start: toMin(st.booking_start), end: toMin(st.booking_end) });

export const loadMinutes = (emp) => emp.appts.reduce((n, a) => n + a.dur + a.buf, 0);

export function pickEmployee(day, serviceId, win, s, dur, buf) {
  const ok = day.emps.filter((e) => e.quals.has(serviceId) && canFit(e, day.closed, win, s, dur, buf));
  ok.sort((a, b) => loadMinutes(a) - loadMinutes(b) || a.id - b.id); // fair distribution: least loaded first
  return ok[0] || null;
}

export function earliestStart(emp, closed, win, dur, buf, notBefore, step) {
  const from = Math.max(win.start, notBefore);
  let t = win.start + Math.ceil((from - win.start) / step) * step;
  for (; t + dur <= win.end; t += step) if (canFit(emp, closed, win, t, dur, buf)) return t;
  return null;
}

/* ---------- Capacity ---------- */
export function sameDayOpen(st, ctx) {
  return st.walkin_enabled && st.walkin_release === 'same_day_time' &&
    ctx.nowMin >= toMin(st.walkin_release_time) && ctx.nowMin < toMin(st.booking_end) - 15;
}

export function dateError(date, st, ctx) {
  const wd = weekdayOf(date);
  if (wd === 0 || wd === 6) return 'The office is closed on weekends. Pick a weekday.';
  const min = sameDayOpen(st, ctx) ? ctx.today : addDays(ctx.today, 1);
  if (date < min) return date === ctx.today ? 'Same-day online booking is not open. Please pick a later date.' : 'Pick a future date.';
  if (date > addDays(ctx.today, st.max_days_ahead)) return `Bookings open up to ${st.max_days_ahead} days ahead.`;
  return null;
}

// Office-wide numbers for one day. Capacity is measured in minutes so long services use more of it than short ones.
export function metrics(day, st, ctx) {
  const win = officeWindow(st);
  // Only staff who are assigned at least one service can take clients, so only their time counts as capacity.
  const capacity = day.emps.filter((e) => e.quals.size > 0).reduce((n, e) => n + freeMinutes(e, day.closed, win), 0);
  const reserve = st.walkin_enabled ? Math.ceil((capacity * st.walkin_reserve_percent) / 100) : 0;
  const released = st.walkin_release === 'same_day_time' && day.date === ctx.today && ctx.nowMin >= toMin(st.walkin_release_time);
  let onlineMin = 0, walkMin = 0, onlineCount = 0, walkCount = 0;
  for (const a of day.appts) {
    if (a.source === 'walk_in') { walkMin += a.dur + a.buf; walkCount++; } else { onlineMin += a.dur + a.buf; onlineCount++; }
  }
  const reserveHeld = released ? 0 : reserve;
  // Walk-ins that exceed the reserve eat into the general pool, so online never gets less than capacity - max(reserve, walk-ins).
  const onlineAllowed = Math.max(capacity - Math.max(reserveHeld, walkMin), 0);
  return {
    capacity, reserve, reserveHeld, released, onlineMin, walkMin, onlineCount, walkCount, onlineAllowed,
    unusedReserved: Math.max(reserve - walkMin, 0),
    remaining: Math.max(capacity - onlineMin - walkMin, 0),
  };
}

export function computeOnlineSlots(day, st, svc, ctx) {
  const buf = st.buffer_minutes;
  const m = metrics(day, st, ctx);
  if (day.closed) return { times: [], reason: 'closed' };
  if (st.daily_online_limit > 0 && m.onlineCount >= st.daily_online_limit) return { times: [], reason: 'limit' };
  if (m.onlineMin + svc.dur + buf > m.onlineAllowed) return { times: [], reason: 'capacity' };
  const win = bookingWindow(st);
  const earliest = day.date === ctx.today ? ctx.nowMin + 15 : 0;
  const qualified = day.emps.filter((e) => e.quals.has(svc.id));
  const times = [];
  for (let t = win.start; t + svc.dur <= win.end; t += st.slot_step_minutes) {
    if (t < earliest) continue;
    if (qualified.some((e) => canFit(e, day.closed, win, t, svc.dur, buf))) times.push(hhmm(t));
  }
  return { times, reason: times.length ? null : qualified.length ? 'full' : 'no_staff' };
}

/* ---------- Hourly availability: how many more visits fit in each hour of the booking window ---------- */
const earliestFrom = (win, from, step) => win.start + Math.ceil((Math.max(from, win.start) - win.start) / step) * step;

export function computeHourlySlots(day, st, svc, ctx) {
  const buf = st.buffer_minutes, step = st.slot_step_minutes;
  if (day.closed) return { hours: [], reason: 'closed' };
  const m = metrics(day, st, ctx);
  const win = bookingWindow(st);
  // Day-wide ceiling so the per-hour numbers never promise more than the online limit and capacity allow.
  const byLimit = st.daily_online_limit > 0 ? st.daily_online_limit - m.onlineCount : Infinity; // 0 = automatic, no fixed cap
  const byTime = Math.floor((m.onlineAllowed - m.onlineMin) / (svc.dur + buf));
  const globalLeft = Math.max(Math.min(byLimit, byTime), 0);
  const qualified = day.emps.filter((e) => e.quals.has(svc.id));
  const earliest = day.date === ctx.today ? ctx.nowMin + 15 : 0;
  const hours = [];
  for (let h = Math.floor(win.start / 60) * 60; h < win.end; h += 60) {
    const hs = Math.max(h, win.start), he = Math.min(h + 60, win.end);
    // Hours nobody works (for example everyone's lunch) are not shown at all.
    if (!qualified.some((e) => workIntervals(e, day.closed, win).some(([a, b]) => a < he && b > hs))) continue;
    let count = 0, vid = -1;
    for (const e of qualified) {
      const virtual = { ...e, appts: [...e.appts] }; // pretend each counted visit is booked so the next one respects it and its buffer
      for (let t = earliestFrom(win, Math.max(hs, earliest), step); t < he && t + svc.dur <= win.end; t += step) {
        if (canFit(virtual, day.closed, win, t, svc.dur, buf)) { count++; virtual.appts.push({ id: vid--, s: t, dur: svc.dur, buf }); }
      }
    }
    hours.push({ hour: hhmm(h), left: Math.min(count, globalLeft) });
  }
  let reason = null;
  if (!hours.some((x) => x.left > 0)) {
    reason = !qualified.length ? 'no_staff' : byLimit <= 0 ? 'limit' : byTime <= 0 ? 'capacity' : 'full';
  }
  return { hours, reason };
}

// The exact start time we assign inside the hour a client picked: the earliest one any qualified employee can take.
export function resolveHourStart(day, st, svc, ctx, hourKey) {
  const { hours, reason } = computeHourlySlots(day, st, svc, ctx);
  const row = hours.find((x) => x.hour === hourKey);
  if (!row || row.left < 1) return { start: null, reason: reason || 'full' };
  const win = bookingWindow(st), buf = st.buffer_minutes, step = st.slot_step_minutes;
  const hs = Math.max(toMin(hourKey), win.start), he = toMin(hourKey) + 60;
  const earliest = day.date === ctx.today ? ctx.nowMin + 15 : 0;
  for (let t = earliestFrom(win, Math.max(hs, earliest), step); t < he && t + svc.dur <= win.end; t += step)
    if (day.emps.some((e) => e.quals.has(svc.id) && canFit(e, day.closed, win, t, svc.dur, buf))) return { start: t, reason: null };
  return { start: null, reason: 'full' };
}

/* ---------- Date and time checks for walk-ins and blocked hours ---------- */
export const WALKIN_PAST_GRACE = 15;   // minutes: staff may register someone who arrived a few minutes ago
export const WALKIN_FUTURE_GRACE = 5;  // minutes: allows for small clock differences

export function walkinArrivalError(arrival, st, ctx) {
  const win = officeWindow(st);
  const hours = `${to12(st.office_open)} to ${to12(st.office_close)}`;
  if (ctx.nowMin < win.start || ctx.nowMin >= win.end)
    return `The office is closed right now. Walk-ins can only be registered during office hours (${hours}).`;
  if (!arrival) return null;
  const a = toMin(arrival);
  const now = to12(hhmm(ctx.nowMin));
  if (a < win.start || a >= win.end) return `Arrival time ${to12(arrival)} is outside office hours (${hours}).`;
  if (a < ctx.nowMin - WALKIN_PAST_GRACE)
    return `Arrival time ${to12(arrival)} has already passed. It is ${now} now. Enter a time from the last ${WALKIN_PAST_GRACE} minutes, or leave it empty to use the current time.`;
  if (a > ctx.nowMin + WALKIN_FUTURE_GRACE)
    return `Arrival time ${to12(arrival)} is in the future. It is ${now} now. Leave it empty to use the current time.`;
  return null;
}

// A blocked hour covers 60 minutes from its start, so it is only pointless once that whole hour is over.
export function blockHourError(date, hour, ctx) {
  if (date === ctx.today && toMin(hour) + 60 <= ctx.nowMin) return `${to12(hour)} has already passed today.`;
  return null;
}

/* ---------- Capacity from staff assignments ---------- */
// How many clients each service, each employee and the whole office can handle on a day, based on who is assigned to what.
export function serviceCapacity(day, st, services) {
  const win = bookingWindow(st), buf = st.buffer_minutes;
  const minutes = new Map(day.emps.map((e) => [e.id, freeMinutes(e, day.closed, win)]));
  const out = services.map((s) => {
    const staff = day.emps.filter((e) => e.quals.has(s.id));
    return {
      id: s.id, purpose: s.purpose, duration_minutes: s.dur,
      staff: staff.map((e) => ({ id: e.id, name: e.name })),
      // If every assigned employee spent the whole day on this service alone:
      max_clients: staff.reduce((n, e) => n + Math.floor(minutes.get(e.id) / (s.dur + buf)), 0),
    };
  });
  const employees = day.emps.map((e) => {
    const mine = services.filter((s) => e.quals.has(s.id));
    const avg = mine.length ? mine.reduce((n, s) => n + s.dur + buf, 0) / mine.length : 0; // average visit incl. buffer across their services
    return {
      id: e.id, name: e.name, service_ids: mine.map((s) => s.id), minutes: minutes.get(e.id),
      clients: avg ? Math.floor(minutes.get(e.id) / avg) : 0,
    };
  });
  return { services: out, employees, total_clients: employees.reduce((n, e) => n + e.clients, 0) };
}

/* ---------- Employee workload ---------- */
export function employeeSummary(emp, closed, win, rows, buf, ctx, date) {
  const t = { total: rows.length, pending: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0 };
  let remaining = 0, remainingMin = 0, booked = 0;
  for (const r of rows) {
    if (r.status in t) t[r.status]++;
    if (r.status === 'cancelled') continue;
    booked += r.dur + r.buf;
    if (r.status === 'completed') continue;
    remaining++; // remaining appointments = not completed and not cancelled
    let m = r.dur; // scheduled duration, so the total is an estimate
    if (r.status === 'in_progress' && r.started_min != null && date === ctx.today) m = Math.max(r.dur - (ctx.nowMin - r.started_min), 0);
    remainingMin += m;
  }
  const capacity = freeMinutes(emp, closed, win);
  const utilization = capacity > 0 ? Math.round((booked / capacity) * 1000) / 10 : null;
  const level = capacity === 0 ? 'off' : utilization >= 90 ? 'overloaded' : utilization < 50 ? 'available' : 'balanced';
  const openMin = Math.max(capacity - booked, 0);
  return {
    ...t, remaining, remaining_minutes: remainingMin,
    capacity_minutes: capacity, booked_minutes: booked, open_minutes: openMin,
    open_slots: Math.floor(openMin / (30 + buf)), // approximate count of 30-minute slots still open
    utilization, level,
  };
}

export { isHHMM };

export const nowCtx = () => ({ today: localToday(), nowMin: nowMinutes() });
