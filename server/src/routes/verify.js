import { Router } from 'express';
import { HttpError, body, email, text } from '../validate.js';
import { requestCode, confirmCode } from '../verification.js';
import { OTP_TTL_MINUTES, OTP_RESEND_SECONDS } from '../otpLogic.js';

const r = Router();

r.post('/request', async (req, res) => {
  const em = email(body(req).email);
  await requestCode(em);
  res.json({ ok: true, expires_in: OTP_TTL_MINUTES * 60, resend_in: OTP_RESEND_SECONDS });
});

r.post('/confirm', async (req, res) => {
  const b = body(req);
  const em = email(b.email);
  const code = text(b.code, 'Code', { min: 1, max: 12 }).replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code from your email.');
  res.json({ verification_token: await confirmCode(em, code) });
});

export default r;
