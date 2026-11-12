// Demo data. Safe to run more than once. Demo accounts only: set SEED_PASSWORD, and change every password before going live.
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

if (process.env.NODE_ENV === 'production' && !process.env.SEED_PASSWORD) {
  console.error('Refusing to create demo accounts in production without SEED_PASSWORD. Create real accounts from the admin panel instead.');
  process.exit(1);
}
const password = process.env.SEED_PASSWORD || 'Password123!';
const hash = await bcrypt.hash(password, 10);
const people = [
  ['Office Admin', 'admin@registry.local', 'admin'],
  ['Maria Lopez', 'maria@registry.local', 'employee'], ['Jose Ramos', 'jose@registry.local', 'employee'],
  ['Ana Villanueva', 'ana@registry.local', 'employee'], ['Carlo Mendoza', 'carlo@registry.local', 'employee'],
  ['Liza Santos', 'liza@registry.local', 'employee'], ['Ramon Cruz', 'ramon@registry.local', 'employee'],
  ['Grace Bautista', 'grace@registry.local', 'employee'], ['Paolo Reyes', 'paolo@registry.local', 'employee'],
  ['Joy Aquino', 'joy@registry.local', 'employee'], ['Mark Flores', 'mark@registry.local', 'employee'],
];
for (const [n, e, r] of people)
  await pool.query('INSERT IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,?)', [n, e, hash, r]);

const [emps] = await pool.query("SELECT id FROM users WHERE role='employee' ORDER BY id");
// Default weekday schedule for anyone who has none
await pool.query(
  `INSERT IGNORE INTO employee_schedules (employee_id, weekday)
   SELECT u.id, d.n FROM users u CROSS JOIN (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) d WHERE u.role='employee'`);
// Qualifications for employees who have none yet: the first six handle everything, the rest handle the short services only.
const [svc] = await pool.query('SELECT id, purpose FROM services');
const short = new Set(['Register of Birth', 'Register of Death', 'Register of Marriage', 'Request of Birth', 'Request of Death', 'Request of Marriage', 'Others']);
for (const [i, e] of emps.entries()) {
  const [[{ c }]] = await pool.query('SELECT COUNT(*) c FROM employee_services WHERE employee_id=?', [e.id]);
  if (c) continue;
  for (const s of svc) if (i < 6 || short.has(s.purpose))
    await pool.query('INSERT IGNORE INTO employee_services (employee_id, service_id) VALUES (?,?)', [e.id, s.id]);
}
console.log(`Seeded. Demo accounts use the password from SEED_PASSWORD (default "${password}"). Sign in as admin@registry.local`);
await pool.end();
