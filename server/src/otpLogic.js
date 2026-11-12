// Email one-time codes: pure helpers (no database), so they can be unit tested.
import crypto from 'crypto';

export const OTP_TTL_MINUTES = 10;       // how long a code works
export const OTP_RESEND_SECONDS = 60;    // wait before another code can be requested for the same email
export const OTP_MAX_ATTEMPTS = 5;       // wrong guesses allowed per code
export const OTP_HOURLY_LIMIT = 8;       // codes per email per hour
export const TOKEN_TTL_MINUTES = 30;     // how long a verified email may be used to book

export const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

// The code is never stored: only an HMAC bound to the email address and the server secret.
export const hashCode = (secret, email, code) => crypto.createHmac('sha256', secret).update(`${email}:${code}`).digest('hex');
export const newToken = () => crypto.randomBytes(24).toString('hex');
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const sameHex = (a, b) => {
  const x = Buffer.from(String(a), 'hex'), y = Buffer.from(String(b), 'hex');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};
