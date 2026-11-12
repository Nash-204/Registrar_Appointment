# Going live: checklist

## 1. Server environment (`server/.env`)
Set these, then start with `NODE_ENV=production`. In production the server refuses to start if a safe value is missing.

| Setting | What to put |
|---|---|
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | your public address, e.g. `https://civilregistry.example.gov.ph` |
| `JWT_SECRET` | 32+ random characters (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). Changing it signs everyone out. |
| `DB_USER` / `DB_PASSWORD` | a dedicated MySQL user (below), never `root`, with a strong password |
| `SMTP_*` | your real mail server. Verification codes and confirmations depend on it. |
| `APP_TIMEZONE` | `Asia/Manila` (default). All "today" and walk-in time checks use it. |
| `TRUST_PROXY` | `1` when behind nginx or a load balancer |

Windows PowerShell: `$env:NODE_ENV='production'; npm start`. Linux: `NODE_ENV=production npm start` (use a process manager such as pm2 or systemd so it restarts after a crash or reboot).

## 2. Database
1. Back up first (Workbench: Server > Data Export).
2. Run `schema.sql` (new installs only), then `002`, `003`, `004` migrations from `database/migrations/`, each once, with an admin account.
3. Create a limited account for the app:
```sql
CREATE USER 'registry_app'@'localhost' IDENTIFIED BY 'use-a-long-random-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON civil_registry.* TO 'registry_app'@'localhost';
```
4. Schedule automatic backups (daily) and test a restore at least once.

## 3. Accounts
- Do not run `npm run seed` in production (it refuses without `SEED_PASSWORD`). Create real accounts from Admin > Employees.
- If demo accounts exist, change every password or delete them, including `admin@registry.local`.

## 4. The website
```
cd client
npm install
npm run build
```
The server serves `client/dist` automatically when it exists, so one process serves the site and the API. Put it behind HTTPS (nginx, Caddy or your host's TLS). Do not expose plain HTTP.

## 5. Before opening to the public
- Replace the placeholder phone, email, address and map in `client/src/siteConfig.js`; add `logo.png` and `hero.jpg` in `client/public/images/`.
- Have the registrar verify every checklist item (Admin > Services and documents). Items marked "Sample: verify" are placeholders.
- Set hours, buffer and walk-in reserve in Admin > Settings; assign services to every employee.
- Run `npm audit` in `server` and `client` and read the results (do not use `--force` blindly).
- Run the tests: `npm test` in `server`; `npm run test:db` against a copy of the database.
- Book a test appointment end to end: verification code email, confirmation email, tracking, status changes.

## Known limits
- Login tokens are kept in the browser's local storage for 8 hours. Keep the site on HTTPS and avoid third-party scripts.
- The chat bot is rule-based. Contact details, map and office text are placeholders until you edit them.
