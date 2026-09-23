import { z } from 'zod';

// Length is the only credential rule we impose. The product owner chose to keep
// sign-up friction low, so there is deliberately no common-password blocklist
// and no composition rule (upper/lower/digit/symbol) here.
//
// Online guessing is instead held back at the login endpoint, which rate-limits
// by IP and locks an account after LOGIN_MAX_FAILED_ATTEMPTS consecutive
// failures for LOGIN_LOCKOUT_MINUTES (see routes/auth.js — finding F-01).
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 200;

// Shared password field used by registration and admin user creation so the
// policy stays consistent across every place an account credential is set.
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`)
  .max(MAX_PASSWORD_LENGTH);
