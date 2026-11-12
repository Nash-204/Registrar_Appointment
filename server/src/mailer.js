import nodemailer from 'nodemailer';
import { bookingEmail, otpEmail } from './emailTemplates.js';

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

// The mail server answering "250 OK" only means it accepted the message. Whether it is delivered is decided later by the
// provider (for example Brevo blocks senders you have not verified), so log what the server said to make that visible.
function logSent(kind, to, info) {
  if (!process.env.SMTP_HOST) return;
  const rejected = info.rejected || [];
  console.log(`[mail] ${kind} to ${to}: ${rejected.length ? `REJECTED ${rejected.join(', ')}` : 'accepted by the mail server'} | ${info.response || ''} | id ${info.messageId || ''}`);
  if (rejected.length && !(info.accepted || []).length) throw new Error('The mail server rejected the recipient address');
}

// Every message carries an HTML version and a plain-text version for apps that cannot show HTML.
export async function sendBookingEmail(a) {
  const { subject, html, text } = bookingEmail(a);
  const info = await transporter.sendMail({ from: process.env.MAIL_FROM, to: a.email, subject, html, text });
  logSent('booking confirmation', a.email, info);
  if (!process.env.SMTP_HOST) console.log(`[mail:dev] Booking confirmation for ${a.email} (${a.reference_code})`);
  return info;
}

export async function sendOtpEmail(address, code, minutes) {
  const { subject, html, text } = otpEmail(code, minutes);
  const info = await transporter.sendMail({ from: process.env.MAIL_FROM, to: address, subject, html, text });
  logSent('verification code', address, info);
  if (!process.env.SMTP_HOST) console.log(`[mail:dev] Verification code for ${address}: ${code}`);
  return info;
}
