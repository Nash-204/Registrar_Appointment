// Database test: needs the real MySQL database from .env with schema.sql, migration 002 and `npm run seed` applied.
//   Windows PowerShell:  $env:RUN_DB_TESTS=1; node --test tests/concurrency.test.js
// It books a far-future weekday that has no appointments, blocks every employee except one, then fires parallel
// bookings for the same time. Exactly one may succeed. It cleans up after itself.
import test from 'node:test';
import assert from 'node:assert/strict';

const run = !!process.env.RUN_DB_TESTS;

test('simultaneous bookings cannot take the same employee slot', { skip: !run }, async () => {
  await import('dotenv/config');
  const { pool } = await import('../src/db.js');
  const { bookOnline, loadService } = await import('../src/scheduling.js');
  const { addDays, localToday, weekdayOf } = await import('../src/time.js');
  let date = addDays(localToday(), 45);
  while ([0, 6].includes(weekdayOf(date))) date = addDays(date, 1);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM appointments WHERE appointment_date=?', [date]);
  assert.equal(n, 0, `${date} already has appointments; pick an empty day`);

  const [[svcRow]] = await pool.query("SELECT id FROM services WHERE purpose='Register of Birth'");
  const service = await loadService(pool, svcRow.id);
  const [emps] = await pool.query("SELECT u.id FROM users u JOIN employee_services es ON es.employee_id=u.id AND es.service_id=? WHERE u.role='employee' ORDER BY u.id", [service.id]);
  assert.ok(emps.length >= 2, 'need at least two qualified employees');
  const keep = emps[0].id;
  for (const e of emps.slice(1)) await pool.query("INSERT INTO blocked_dates (employee_id,date,reason) VALUES (?,?,'TEST')", [e.id, date]);
  try {
    const attempts = Array.from({ length: 6 }, (_, i) =>
      bookOnline({ service, custom: null, full_name: `Test Person ${i}`, email: `race${i}@example.com`, phone: '09170000000', date, time: '10:00' })
        .then(() => 'ok', (e) => `fail:${e.status}`));
    const results = await Promise.all(attempts);
    assert.equal(results.filter((r) => r === 'ok').length, 1, JSON.stringify(results));
    assert.ok(results.filter((r) => r !== 'ok').every((r) => r === 'fail:409'));
    const [rows] = await pool.query('SELECT handled_by FROM appointments WHERE appointment_date=?', [date]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].handled_by, keep);
  } finally {
    await pool.query("DELETE FROM appointments WHERE appointment_date=? AND email LIKE 'race%@example.com'", [date]);
    await pool.query("DELETE FROM blocked_dates WHERE date=? AND reason='TEST'", [date]);
    await pool.end();
  }
});
