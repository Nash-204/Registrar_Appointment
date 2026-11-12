// Run with:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDay, canFit, computeOnlineSlots, computeHourlySlots, resolveHourStart, serviceCapacity, metrics, pickEmployee, earliestStart, dateError, employeeSummary,
  bookingWindow, officeWindow, newReference } from '../src/scheduleLogic.js';
import { DEFAULTS, validateSettingsUpdate } from '../src/settingsLogic.js';

const ST = { ...DEFAULTS };                   // 8-17 office, 9-16 booking, 5 min buffer, 10 min step, limit 65, 20% reserve
const DATE = '2030-01-08';                    // a Tuesday
const CTX = { today: '2030-01-07', nowMin: 600 };
const REG = 1, CORR = 2;                      // service ids
const REG_DUR = 20, CORR_DUR = 60;

function day({ employees = 1, qualsFor = {}, appts = [], blockedSlots = [], blockedDates = [] } = {}) {
  const emps = Array.from({ length: employees }, (_, i) => ({ id: i + 1, name: `E${i + 1}` }));
  return buildDay({
    date: DATE, employees: emps,
    schedules: emps.map((e) => ({ employee_id: e.id, is_working: 1, start_time: '08:00', end_time: '17:00', lunch_start: '12:00', lunch_end: '13:00' })),
    quals: emps.flatMap((e) => (qualsFor[e.id] || [REG, CORR]).map((s) => ({ employee_id: e.id, service_id: s }))),
    blockedDates, blockedSlots, appts,
  });
}
const appt = (id, emp, t, dur, source = 'online', status = 'pending', buf = 5) => ({ id, handled_by: emp, source, status, t, dur, buf });

test('a second client cannot take a slot the first client already holds (no overlap)', () => {
  const win = bookingWindow(ST);
  const d1 = day();
  assert.equal(canFit(d1.emps[0], false, win, 600, REG_DUR, 5), true);
  const d2 = day({ appts: [appt(1, 1, '10:00', REG_DUR)] });
  assert.equal(canFit(d2.emps[0], false, win, 600, REG_DUR, 5), false);
  assert.equal(canFit(d2.emps[0], false, win, 610, REG_DUR, 5), false); // overlaps the first appointment
  assert.equal(canFit(d2.emps[0], false, win, 625, REG_DUR, 5), true);  // 10:00 + 20 + 5 buffer
  assert.equal(canFit(d2.emps[0], false, win, 620, REG_DUR, 5), false); // inside the buffer
});

test('buffer is also kept BEFORE the next appointment', () => {
  const win = bookingWindow(ST);
  const d = day({ appts: [appt(1, 1, '10:30', REG_DUR)] });
  assert.equal(canFit(d.emps[0], false, win, 605, REG_DUR, 5), true);   // ends 10:25, +5 = 10:30 exactly
  assert.equal(canFit(d.emps[0], false, win, 610, REG_DUR, 5), false);
});

test('no times are offered outside the 9:00-16:00 booking hours', () => {
  const { times } = computeOnlineSlots(day(), ST, { id: REG, dur: REG_DUR }, CTX);
  assert.ok(times.length > 0);
  assert.ok(!times.includes('08:00') && !times.includes('08:50'));
  assert.equal(times[0], '09:00');
  assert.ok(times.at(-1) <= '15:40');            // a 20 minute visit must END by 16:00
  assert.ok(!times.some((t) => t >= '11:50' && t < '13:00')); // lunch 12:00-13:00 is never offered
});

test('a 60 minute correction cannot fit into a shorter remaining gap', () => {
  // Free gap 10:00-10:45 (appointment at 09:00-10:00+5 buffer before, another at 10:45)
  const d = day({ appts: [appt(1, 1, '09:00', 55, 'online', 'pending', 5), appt(2, 1, '11:00', REG_DUR)] });
  const corr = computeOnlineSlots(d, ST, { id: CORR, dur: CORR_DUR }, CTX).times;
  assert.ok(!corr.includes('10:00') && !corr.includes('10:10'));
  const reg = computeOnlineSlots(d, ST, { id: REG, dur: REG_DUR }, CTX).times;
  assert.ok(reg.includes('10:00'));              // the same gap does fit a 20 minute service
  const dEnd = computeOnlineSlots(day(), ST, { id: CORR, dur: CORR_DUR }, CTX).times;
  assert.ok(dEnd.includes('15:00') && !dEnd.includes('15:10')); // latest 60 minute start is 15:00
});

test('an employee is never given a service they are not qualified for', () => {
  const d = day({ employees: 2, qualsFor: { 1: [REG], 2: [REG] } });
  const r = computeOnlineSlots(d, ST, { id: CORR, dur: CORR_DUR }, CTX);
  assert.deepEqual(r.times, []);
  assert.equal(r.reason, 'no_staff');
  const d2 = day({ employees: 2, qualsFor: { 1: [REG], 2: [REG, CORR] } });
  const win = bookingWindow(ST);
  assert.equal(pickEmployee(d2, CORR, win, 600, CORR_DUR, 5).id, 2);
});

test('pickEmployee spreads work: least loaded qualified employee first', () => {
  const d = day({ employees: 3, appts: [appt(1, 1, '09:00', REG_DUR), appt(2, 1, '09:30', REG_DUR), appt(3, 2, '09:00', REG_DUR)] });
  assert.equal(pickEmployee(d, REG, bookingWindow(ST), 600, REG_DUR, 5).id, 3);
});

test('lunch break, blocked slots and blocked dates remove availability', () => {
  const win = bookingWindow(ST);
  const base = day();
  assert.equal(canFit(base.emps[0], false, win, 11 * 60 + 50, REG_DUR, 5), false); // runs into lunch
  const blocked = day({ blockedSlots: [{ employee_id: 1, t: '10:00' }] });
  assert.equal(canFit(blocked.emps[0], false, win, 10 * 60 + 30, REG_DUR, 5), false);
  assert.equal(canFit(blocked.emps[0], false, win, 11 * 60, REG_DUR, 5), true);
  const off = day({ blockedDates: [{ employee_id: 1 }] });
  assert.deepEqual(computeOnlineSlots(off, ST, { id: REG, dur: REG_DUR }, CTX).times, []);
  const closed = day({ blockedDates: [{ employee_id: null }] });
  assert.equal(computeOnlineSlots(closed, ST, { id: REG, dur: REG_DUR }, CTX).reason, 'closed');
});

test('the daily online limit is enforced', () => {
  const appts = [appt(1, 1, '09:00', REG_DUR), appt(2, 1, '10:00', REG_DUR)];
  const r = computeOnlineSlots(day({ appts }), { ...ST, daily_online_limit: 2 }, { id: REG, dur: REG_DUR }, CTX);
  assert.equal(r.reason, 'limit');
  assert.deepEqual(r.times, []);
  assert.ok(computeOnlineSlots(day({ appts }), { ...ST, daily_online_limit: 3 }, { id: REG, dur: REG_DUR }, CTX).times.length > 0);
});

test('walk-in reserve is preserved: online stops at capacity minus the reserve', () => {
  const d0 = day({ employees: 1 });
  const m0 = metrics(d0, ST, CTX);
  assert.equal(m0.capacity, 8 * 60);                         // 8:00-17:00 minus lunch = 480
  assert.equal(m0.reserve, Math.ceil(480 * 0.2));            // 96
  assert.equal(m0.onlineAllowed, 480 - 96);
  // Fill online up to the allowed minutes: 25 minute blocks, 15 of them = 375, a 16th = 400 > 384
  const appts = Array.from({ length: 15 }, (_, i) => appt(i + 1, 1, '09:00', REG_DUR, 'online'));
  const r = computeOnlineSlots(day({ appts }), ST, { id: REG, dur: REG_DUR }, CTX);
  assert.equal(r.reason, 'capacity');
  // With the reserve switched off, the same day is not blocked by capacity
  const off = computeOnlineSlots(day({ appts }), { ...ST, walkin_enabled: false }, { id: REG, dur: REG_DUR }, CTX);
  assert.notEqual(off.reason, 'capacity');
});

test('walk-ins use the reserve; unused reserve is reported; no double counting', () => {
  const appts = [appt(1, 1, '09:00', REG_DUR, 'online'), appt(2, 1, '09:30', REG_DUR, 'walk_in')];
  const m = metrics(day({ appts }), ST, CTX);
  assert.equal(m.onlineCount, 1);
  assert.equal(m.walkCount, 1);
  assert.equal(m.onlineMin, 25);
  assert.equal(m.walkMin, 25);
  assert.equal(m.unusedReserved, 96 - 25);
  assert.equal(m.remaining, 480 - 50);                       // each appointment counted once
});

test('walk-ins beyond the reserve reduce what online can use', () => {
  const walk = Array.from({ length: 5 }, (_, i) => appt(i + 1, 1, '08:00', REG_DUR, 'walk_in')); // 125 min > 96 reserve
  const m = metrics(day({ appts: walk }), ST, CTX);
  assert.equal(m.unusedReserved, 0);
  assert.equal(m.onlineAllowed, 480 - 125);
});

test('reserved capacity is released only when the policy says so', () => {
  const same = { today: DATE, nowMin: 15 * 60 };
  const never = metrics(day(), { ...ST, walkin_release: 'never' }, same);
  assert.equal(never.reserveHeld, 96);
  const policy = { ...ST, walkin_release: 'same_day_time', walkin_release_time: '14:00' };
  assert.equal(metrics(day(), policy, same).reserveHeld, 0);               // after 14:00 today: released
  assert.equal(metrics(day(), policy, { today: DATE, nowMin: 13 * 60 }).reserveHeld, 96); // before: held
  assert.equal(metrics(day(), policy, { today: '2030-01-07', nowMin: 15 * 60 }).reserveHeld, 96); // other days: held
});

test('walk-in start search uses the same rules and the office window (8:00-17:00)', () => {
  const win = officeWindow(ST);
  const d = day({ appts: [appt(1, 1, '08:00', CORR_DUR)] });
  assert.equal(earliestStart(d.emps[0], false, win, REG_DUR, 5, 8 * 60, 10), 8 * 60 + 70); // 08:00+60+5 -> next grid 09:10
  const full = day({ appts: [appt(1, 1, '08:00', 240, 'online', 'pending', 0), appt(2, 1, '13:00', 240, 'online', 'pending', 0)] });
  assert.equal(earliestStart(full.emps[0], false, win, REG_DUR, 5, 8 * 60, 10), null);
});

test('date rules: weekends, past dates, too far ahead, same-day policy', () => {
  assert.match(dateError('2030-01-12', ST, CTX), /weekend/i);        // Saturday
  assert.ok(dateError('2030-01-07', ST, CTX));                       // today not open by default
  assert.equal(dateError('2030-01-08', ST, CTX), null);
  assert.ok(dateError('2031-01-08', ST, CTX));                       // beyond 60 days
  const open = { ...ST, walkin_release: 'same_day_time' };
  assert.equal(dateError('2030-01-07', open, { today: '2030-01-07', nowMin: 14 * 60 + 30 }), null);
});

test('workload: remaining is not-completed-and-not-cancelled; utilization from real minutes', () => {
  const win = officeWindow(ST);
  const d = day();
  const rows = [
    { status: 'completed', dur: 20, buf: 5 }, { status: 'cancelled', dur: 60, buf: 5 }, { status: 'pending', dur: 20, buf: 5 },
    { status: 'confirmed', dur: 60, buf: 5 }, { status: 'in_progress', dur: 30, buf: 5, started_min: 590 },
  ];
  const s = employeeSummary(d.emps[0], false, win, rows, 5, CTX, '2030-01-07');
  assert.equal(s.total, 5);
  assert.equal(s.completed, 1); assert.equal(s.cancelled, 1);
  assert.equal(s.remaining, 3);                                        // pending + confirmed + in progress
  assert.equal(s.remaining_minutes, 20 + 60 + 20);                     // in progress: 30 - 10 elapsed
  assert.equal(s.booked_minutes, 25 + 25 + 65 + 35);                   // cancelled excluded
  assert.equal(s.capacity_minutes, 480);
  assert.equal(s.utilization, Math.round((150 / 480) * 1000) / 10);
  assert.equal(s.level, 'available');
  const heavy = employeeSummary(d.emps[0], false, win, Array.from({ length: 18 }, () => ({ status: 'pending', dur: 20, buf: 5 })), 5, CTX, DATE);
  assert.equal(heavy.level, 'overloaded');
});

test('settings are validated on the server', () => {
  assert.throws(() => validateSettingsUpdate({ buffer_minutes: 3 }, ST), /Buffer/);
  assert.throws(() => validateSettingsUpdate({ buffer_minutes: 11 }, ST), /Buffer/);
  assert.throws(() => validateSettingsUpdate({ booking_start: '07:00' }, ST), /inside office hours/);
  assert.throws(() => validateSettingsUpdate({ booking_end: '17:30' }, ST), /inside office hours/);
  assert.equal(validateSettingsUpdate({ daily_online_limit: 0 }, ST).next.daily_online_limit, 0); // 0 = automatic
  assert.throws(() => validateSettingsUpdate({ daily_online_limit: -1 }, ST));
  assert.throws(() => validateSettingsUpdate({ daily_online_limit: 501 }, ST));
  assert.throws(() => validateSettingsUpdate({ daily_online_limit: '65; DROP TABLE users' }, ST));
  assert.throws(() => validateSettingsUpdate({ walkin_reserve_percent: 90 }, ST));
  assert.throws(() => validateSettingsUpdate({ evil: 1 }, ST), /Unknown/);
  assert.throws(() => validateSettingsUpdate({ walkin_release: 'always' }, ST));
  const ok = validateSettingsUpdate({ daily_online_limit: '70', walkin_reserve_percent: 25, buffer_minutes: 10 }, ST);
  assert.equal(ok.next.daily_online_limit, 70);
  assert.deepEqual(Object.keys(ok.changed).sort(), ['buffer_minutes', 'daily_online_limit', 'walkin_reserve_percent']);
});

test('reference codes are unpredictable and well formed', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const c = newReference();
    assert.match(c, /^CR-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    seen.add(c);
  }
  assert.equal(seen.size, 5000);
});

const hoursOf = (d, svc, st = ST) => Object.fromEntries(computeHourlySlots(d, st, svc, CTX).hours.map((h) => [h.hour, h.left]));
const REGSVC = { id: REG, dur: REG_DUR }, CORRSVC = { id: CORR, dur: CORR_DUR };

test('hourly view: slots left per hour, counting buffers; lunch hour is not shown', () => {
  const one = hoursOf(day(), REGSVC);
  assert.deepEqual(Object.keys(one), ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00']); // no 12:00 (lunch)
  assert.equal(one['09:00'], 2);                       // 9:00 and 9:30 (20 min + 5 min buffer each)
  const three = hoursOf(day({ employees: 3 }), REGSVC);
  assert.equal(three['09:00'], 6);                     // three employees
});

test('hourly view: a booked visit reduces that hour only, and a full hour shows 0', () => {
  const d = day({ appts: [appt(1, 1, '09:00', REG_DUR)] });
  const h = hoursOf(d, REGSVC);
  assert.equal(h['09:00'], 1);
  assert.equal(h['10:00'], 2);
  const full = day({ appts: [appt(1, 1, '09:00', 55, 'online', 'pending', 5)] });
  assert.equal(hoursOf(full, REGSVC)['09:00'], 0);     // 9:00-10:00 fully taken
});

test('hourly view: long services need room, so the last hour for a 60 minute correction is 15:00', () => {
  const h = hoursOf(day(), CORRSVC);
  assert.equal(h['15:00'], 1);
  assert.equal(h['11:00'], 1);                         // 11:00-12:00 ends exactly at lunch
  assert.equal(h['09:00'], 1);
});

test('hourly view never promises more than the daily online limit allows', () => {
  const appts = Array.from({ length: 4 }, (_, i) => appt(i + 1, 1, `${9 + i}:00`.padStart(5, '0'), REG_DUR));
  const h = hoursOf(day({ employees: 3, appts }), REGSVC, { ...ST, daily_online_limit: 5 });
  assert.ok(Object.values(h).every((n) => n <= 1));    // only 1 left in total
  const none = computeHourlySlots(day({ appts }), { ...ST, daily_online_limit: 4 }, REGSVC, CTX);
  assert.equal(none.reason, 'limit');
  assert.ok(none.hours.every((x) => x.left === 0));
});

test('hourly view respects qualifications and blocked dates', () => {
  const d = day({ employees: 2, qualsFor: { 1: [REG], 2: [REG] } });
  const r = computeHourlySlots(d, ST, CORRSVC, CTX);
  assert.deepEqual(r.hours, []);
  assert.equal(r.reason, 'no_staff');
  assert.equal(computeHourlySlots(day({ blockedDates: [{ employee_id: null }] }), ST, REGSVC, CTX).reason, 'closed');
});

test('the exact start time is assigned inside the chosen hour (earliest free)', () => {
  assert.equal(resolveHourStart(day(), ST, REGSVC, CTX, '10:00').start, 600);
  const d = day({ appts: [appt(1, 1, '10:00', REG_DUR)] });
  assert.equal(resolveHourStart(d, ST, REGSVC, CTX, '10:00').start, 630);        // 10:00 + 20 + 5 buffer, next grid step
  const taken = day({ appts: [appt(1, 1, '09:00', 55, 'online', 'pending', 5)] });
  const r = resolveHourStart(taken, ST, REGSVC, CTX, '09:00');
  assert.equal(r.start, null);                                                  // full hour: cannot be booked
  assert.equal(resolveHourStart(day(), ST, REGSVC, CTX, '12:00').start, null);  // lunch hour
});

// ---- Capacity follows the staff assigned to each service ----
const SVCS = [
  { id: 1, purpose: 'Register of Birth', dur: 20 }, { id: 2, purpose: 'Correction of Birth', dur: 60 },
  { id: 3, purpose: 'Request of Birth', dur: 20 }, { id: 4, purpose: 'Supplemental', dur: 30 },
];

test('Jacob handles Register and Request, Mika handles Correction and Supplemental: capacity follows the assignment', () => {
  const d = day({ employees: 2, qualsFor: { 1: [1, 3], 2: [2, 4] } }); // 1 = Jacob, 2 = Mika
  const c = serviceCapacity(d, ST, SVCS);
  const by = Object.fromEntries(c.services.map((x) => [x.id, x]));
  assert.deepEqual(by[1].staff.map((x) => x.name), ['E1']);                 // only Jacob can do Register
  assert.deepEqual(by[2].staff.map((x) => x.name), ['E2']);                 // only Mika can do Correction
  assert.equal(by[1].max_clients, Math.floor(360 / 25));                    // 9-12 and 13-16 = 360 minutes, 25 per visit
  assert.equal(by[2].max_clients, Math.floor(360 / 65));
  assert.equal(by[4].max_clients, Math.floor(360 / 35));
  const jacob = c.employees.find((e) => e.id === 1), mika = c.employees.find((e) => e.id === 2);
  assert.equal(jacob.clients, Math.floor(360 / 25));                        // both his services cost 25 minutes
  assert.equal(mika.clients, Math.floor(360 / 50));                         // average of 65 and 35
  assert.equal(c.total_clients, jacob.clients + mika.clients);
});

test('adding a second person to a service raises that service capacity', () => {
  const one = serviceCapacity(day({ employees: 1, qualsFor: { 1: [1] } }), ST, SVCS).services.find((x) => x.id === 1).max_clients;
  const two = serviceCapacity(day({ employees: 2, qualsFor: { 1: [1], 2: [1] } }), ST, SVCS).services.find((x) => x.id === 1).max_clients;
  assert.equal(two, one * 2);
});

test('only the assigned staff can be booked for a service, and unassigned staff add no capacity', () => {
  const d = day({ employees: 2, qualsFor: { 1: [1, 3], 2: [2, 4] } });
  const corr = hoursOf(d, { id: 2, dur: 60 });
  const regOnly = hoursOf(day({ employees: 1, qualsFor: { 1: [2] } }), { id: 2, dur: 60 });
  assert.deepEqual(corr, regOnly);                                          // Jacob adds nothing to Correction
  const none = metrics(day({ employees: 2, qualsFor: { 1: [1], 2: [] } }), ST, CTX);
  const solo = metrics(day({ employees: 1, qualsFor: { 1: [1] } }), ST, CTX);
  assert.equal(none.capacity, solo.capacity);                               // the employee with no services is not counted
});

test('automatic daily limit (0) never caps; a fixed limit still does', () => {
  const appts = Array.from({ length: 30 }, (_, i) => appt(i + 1, 1, '09:00', 5, 'online', 'pending', 0));
  const auto = computeOnlineSlots(day({ employees: 3, appts }), { ...ST, daily_online_limit: 0 }, REGSVC, CTX);
  assert.notEqual(auto.reason, 'limit');
  const fixed = computeOnlineSlots(day({ employees: 3, appts }), { ...ST, daily_online_limit: 30 }, REGSVC, CTX);
  assert.equal(fixed.reason, 'limit');
});
