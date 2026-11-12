// Checks your email settings without starting the website.
// Usage (in the server folder):  npm run mail:test -- you@example.com
import 'dotenv/config';
import nodemailer from 'nodemailer';

const to = process.argv[2];
if (!process.env.SMTP_HOST) {
  console.error('SMTP_HOST is empty in server/.env, so the portal only prints emails in this window and never sends them.');
  process.exit(1);
}
if (!to) { console.error('Add the address to send to:  npm run mail:test -- you@example.com'); process.exit(1); }

console.log(`Sending from: ${process.env.MAIL_FROM || '(MAIL_FROM is empty!)'}  via ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}  as ${process.env.SMTP_USER || '(no login)'}`);
if (!process.env.MAIL_FROM) { console.error('MAIL_FROM is empty in server/.env.'); process.exit(1); }

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  connectionTimeout: 15000,
});

const hint = (e) => {
  const m = String(e.message || '');
  if (e.code === 'EAUTH' || /535|Invalid login|Username and Password/i.test(m)) return 'The username or password was refused. Gmail needs an App Password (not your normal password), typed without spaces.';
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNECTION' || e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED') return 'Could not reach the mail server. Check SMTP_HOST and SMTP_PORT, and that your network or firewall allows that port.';
  if (/wrong version number|ssl3_get_record|greeting never received/i.test(m)) return 'Port and SMTP_SECURE do not match. Use port 587 with SMTP_SECURE=false, or port 465 with SMTP_SECURE=true.';
  if (/self.signed|certificate/i.test(m)) return 'The server certificate was not trusted. Ask your mail provider for the correct host name.';
  if (/sender|from address|not owned|553|550/i.test(m)) return 'The server rejected the sender. MAIL_FROM must use an address your SMTP account is allowed to send from.';
  return 'See the message above.';
};

try {
  await transporter.verify();
  console.log(`Connected to ${process.env.SMTP_HOST} and signed in OK.`);
} catch (e) {
  console.error('Could not connect or sign in:', e.message);
  console.error('Hint:', hint(e));
  process.exit(1);
}

try {
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: 'Test email from the Civil Registry portal',
    text: 'If you can read this, the portal can send email. Verification codes and appointment confirmations will work.',
  });
  console.log(`Mail server answer: ${info.response}`);
  console.log(`Accepted: ${(info.accepted || []).join(', ') || 'none'}   Rejected: ${(info.rejected || []).join(', ') || 'none'}   Message id: ${info.messageId}`);
  console.log('"Accepted" only means the mail server took the message. Now check the inbox and spam folder.');
  console.log('If nothing arrives, open your provider\'s sending log (for Brevo: Transactional > Logs). It shows delivered, blocked or bounced, and why.');
} catch (e) {
  console.error('Connected, but sending failed:', e.message);
  console.error('Hint:', hint(e));
  process.exit(1);
}
