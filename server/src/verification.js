// Email verification for online bookings: send a 6-digit code, confirm it, then trade it for a single-use booking token.
import { pool } from './db.js';
import { HttpError } from './validate.js';
import { sendOtpEmail } from './mailer.js';
import {
  OTP_TTL_MINUTES, OTP_RESEND_SECONDS, OTP_MAX_ATTEMPTS, OTP_HOURLY_LIMIT, TOKEN_TTL_MINUTES,
  generateCode, hashCode, newToken, hashToken, sameHex,
} from './otpLogic.js';

const secret = () => process.env.JWT_SECRET;

export async function requestCode(email) {
  const [[last]] = await pool.query('SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) age FROM email_verifications WHERE email=? ORDER BY id DESC LIMIT 1', [email]);
  if (last && last.age < OTP_RESEND_SECONDS)
    throw new HttpError(429, `Please wait ${OTP_RESEND_SECONDS - last.age} seconds before asking for another code.`);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM email_verifications WHERE email=? AND created_at > NOW() - INTERVAL 1 HOUR', [email]);
  if (n >= OTP_HOURLY_LIMIT) throw new HttpError(429, 'Too many codes were requested for this email. Please try again in an hour.');

  const code = generateCode();
  // Older unused codes stop working as soon as a new one is issued.
  await pool.query('UPDATE email_verifications SET expires_at=NOW() WHERE email=? AND verified_at IS NULL AND expires_at>NOW()', [email]);
  const [ins] = await pool.query(
    `INSERT INTO email_verifications (email, code_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${OTP_TTL_MINUTES} MINUTE))`,
    [email, hashCode(secret(), email, code)]);
  try { await sendOtpEmail(email, code, OTP_TTL_MINUTES); }
  catch (e) {
    console.error('OTP email failed:', e.message);
    await pool.query('DELETE FROM email_verifications WHERE id=?', [ins.insertId]);
    throw new HttpError(502, 'We could not send the code. Check the email address, or try again in a moment.');
  }
  if (Math.random() < 0.05) pool.query('DELETE FROM email_verifications WHERE created_at < NOW() - INTERVAL 2 DAY').catch(() => {}); // housekeeping
}

export async function confirmCode(email, code) {
  const [[row]] = await pool.query(
    'SELECT id, code_hash, attempts FROM email_verifications WHERE email=? AND verified_at IS NULL AND expires_at>NOW() ORDER BY id DESC LIMIT 1', [email]);
  if (!row || row.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(400, 'That code has expired. Please request a new one.');
  if (!sameHex(row.code_hash, hashCode(secret(), email, code))) {
    await pool.query('UPDATE email_verifications SET attempts=attempts+1 WHERE id=?', [row.id]);
    const left = OTP_MAX_ATTEMPTS - row.attempts - 1;
    if (left <= 0) {
      await pool.query('UPDATE email_verifications SET expires_at=NOW() WHERE id=?', [row.id]);
      throw new HttpError(400, 'Too many wrong attempts. Please request a new code.');
    }
    throw new HttpError(400, `That code is not correct. You have ${left} ${left === 1 ? 'try' : 'tries'} left.`);
  }
  const token = newToken();
  await pool.query('UPDATE email_verifications SET verified_at=NOW(), token_hash=?, expires_at=NOW() WHERE id=?', [hashToken(token), row.id]);
  return token;
}

// Called inside the booking transaction: the token works once, for the same email, within TOKEN_TTL_MINUTES.
export async function consumeVerification(conn, email, token) {
  const bad = new HttpError(400, 'Please verify your email address first.');
  if (typeof token !== 'string' || !/^[0-9a-f]{48}$/.test(token)) throw bad;
  const [[row]] = await conn.query(
    `SELECT id FROM email_verifications WHERE email=? AND token_hash=? AND verified_at IS NOT NULL AND consumed_at IS NULL
       AND verified_at > NOW() - INTERVAL ${TOKEN_TTL_MINUTES} MINUTE LIMIT 1 FOR UPDATE`, [email, hashToken(token)]);
  if (!row) throw bad;
  await conn.query('UPDATE email_verifications SET consumed_at=NOW() WHERE id=?', [row.id]);
}
