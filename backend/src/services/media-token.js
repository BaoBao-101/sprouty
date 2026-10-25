import { createHmac, timingSafeEqual } from 'crypto';

/*
 * Read-only passes for private uploads, for the mobile app.
 *
 * The website fetches /uploads/* on its own origin, so the session cookie rides
 * along with every <img> and <video>. The app cannot do that: it signs in with a
 * bearer token, and the native image and video players it hands a URL to send
 * no Authorization header — so a leaf photo or an instruction video would 401.
 *
 * So the app asks for one of these and appends it as `?mt=`. It names the user
 * and an expiry, signed with the cookie secret; it opens files the user could
 * open anyway (assetGuard still applies every rule) and nothing else — it is
 * not a session and is refused everywhere outside the upload mount. A short
 * lifetime bounds what a leaked URL is worth.
 */

const DEFAULT_TTL_SECONDS = 6 * 60 * 60;

function secret() {
  return process.env.COOKIE_SECRET || 'sprouty-dev-change-this-in-production-use-32-char-random-string';
}

function signature(payload) {
  return createHmac('sha256', secret()).update(`media:${payload}`).digest('base64url');
}

export function mediaTokenTtlSeconds() {
  const parsed = Number(process.env.MEDIA_TOKEN_TTL_MINUTES);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 60) : DEFAULT_TTL_SECONDS;
}

/** `<userId>.<expiry in unix seconds>.<signature>` */
export function signMediaToken(userId, { now = Date.now(), ttlSeconds = mediaTokenTtlSeconds() } = {}) {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const payload = `${userId}.${exp}`;
  return { token: `${payload}.${signature(payload)}`, expiresAt: new Date(exp * 1000) };
}

/** The user id the token was issued to, or null if it is malformed, forged or spent. */
export function verifyMediaToken(token, { now = Date.now() } = {}) {
  if (typeof token !== 'string' || token.length > 200) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expText, given] = parts;
  if (!/^[a-z0-9]{8,40}$/i.test(userId) || !/^\d{1,12}$/.test(expText)) return null;

  const expected = Buffer.from(signature(`${userId}.${expText}`));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  if (Number(expText) * 1000 <= now) return null;
  return userId;
}
