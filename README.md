# Civil Registry Office Portal

React + Vite + Tailwind (client), Express (server), MySQL.

## First-time setup (MySQL Workbench)
1. Run `database/schema.sql`, then `database/migrations/002_scheduling.sql`, then `database/migrations/003_front_desk.sql` (File > Open SQL Script > run the whole script each time).
2. `cd server`, copy `.env.example` to `.env` (database login, `JWT_SECRET` of 32+ random characters, SMTP), then `npm install`, `npm run seed`, `npm run dev`.
3. `cd client`, `npm install`, `npm run dev`, then open http://localhost:5173.

## Upgrading an existing database
Run the migrations you haven't run yet, in order: `002_scheduling.sql` (once), then `003_front_desk.sql`. Run 003 BEFORE restarting the server, because the server now reads the front desk column. It keeps all existing appointments, adds the new columns and tables, links old appointments to services, and gives existing employees a default Monday-Friday schedule and every service. Then run `npm install` in `server`, restart, and `npm run seed` if you want the extra demo employees.

## Front desk
In Admin > Employees, tick **Front desk** for an employee (when adding them or later). They then also see All appointments, All workload, Capacity and Walk-ins, can update and assign any appointment, and can register walk-ins for any employee. They cannot open Overview, Chats assignment, Employees, Services or Settings. Appointment lists show the latest appointment first; the Sort box also offers earliest first and newest booking first.

## How capacity works
Each employee is assigned the services they handle (Admin > Employees > Edit services and schedule, or when adding the employee). A service can only be booked with staff assigned to it, so the people assigned to a service decide how many clients it can take per day. Admin > Capacity shows clients per day for each service and each employee. In Settings, "Online appointments per day" can be Automatic (recommended, based on assigned staff) or a fixed number. To switch an existing database to Automatic without the screen: `UPDATE civil_registry.settings SET setting_value='0' WHERE setting_key='daily_online_limit';`

## Demo accounts
`admin@registry.local` and ten demo employees (`maria@`, `jose@`, `ana@`, `carlo@`, `liza@`, `ramon@`, `grace@`, `paolo@`, `joy@`, `mark@registry.local`). The seed password is `Password123!` unless you set `SEED_PASSWORD`. These are demo accounts: change every password before going live.

## Tests
- `npm test` (in `server`): 17 unit tests of the scheduling, capacity, walk-in and settings rules. No database needed.
- `npm run test:db`: needs the real database. PowerShell: `$env:RUN_DB_TESTS=1; npm run test:db`. Fires parallel bookings for the same slot and checks only one succeeds. It cleans up after itself.

Without SMTP settings, confirmation emails are printed to the server console instead of being sent.

## Look and content
- Put your logo and hero photo in `client/public/images/` (`logo.png`, `hero.jpg`). See the README.txt in that folder.
- Office name, address, phone, email and hours: `client/src/siteConfig.js`.
- Purposes and required documents shown in the home page carousel: `client/src/data/services.js`.
