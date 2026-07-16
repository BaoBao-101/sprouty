import { z } from 'zod';

// NIST 800-63B favours length + a breached/common-password screen over forced
// composition rules. We enforce a 10-char minimum and reject the passwords that
// dominate credential-stuffing lists. (A full breach-corpus check, e.g. the HIBP
// range API, can be layered on later without changing this schema's shape.)
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

// Lower-cased, whitespace-trimmed comparison set of the most common weak
// passwords plus a few brand-obvious ones. Kept deliberately small and cheap.
const COMMON_PASSWORDS = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '12345678910',
  'password', 'password1', 'password123', 'passw0rd', 'qwerty', 'qwerty123',
  'qwertyuiop', 'abc123', 'abcd1234', '111111', '000000', '11111111',
  'iloveyou', 'admin', 'admin123', 'letmein', 'welcome', 'welcome1',
  'monkey', 'dragon', 'football', 'baseball', 'sunshine', 'princess',
  'trustno1', 'whatever', 'starwars', 'changeme', 'change-me', 'secret',
  'sprouty', 'sprouty123', 'garden', 'garden123',
]);

// A password made of a single repeated character (e.g. "aaaaaaaaaa") clears the
// length check but is trivially guessable.
function isSingleRepeatedChar(pw) {
  return /^(.)\1+$/.test(pw);
}

export function isWeakPassword(password) {
  const normalized = String(password || '').trim().toLowerCase();
  return COMMON_PASSWORDS.has(normalized) || isSingleRepeatedChar(normalized);
}

// Shared password field used by registration and admin user creation so the
// policy stays consistent across every place an account credential is set.
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`)
  .max(MAX_PASSWORD_LENGTH)
  .refine((pw) => !isWeakPassword(pw), {
    message: 'Mật khẩu quá phổ biến hoặc quá yếu. Vui lòng chọn mật khẩu khác.',
  });
