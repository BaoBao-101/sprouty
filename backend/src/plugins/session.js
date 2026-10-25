import fp from 'fastify-plugin';
import { randomBytes } from 'crypto';

const SESSION_COOKIE = 'session_id';
const minutes = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * 60 * 1000 : fallback;
};
const hours = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * 60 * 60 * 1000 : fallback;
};

const days = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * 24 * 60 * 60 * 1000 : fallback;
};

const SESSION_IDLE_TIMEOUT_MS = minutes(process.env.SESSION_IDLE_TIMEOUT_MINUTES, 30 * 60 * 1000);
const SESSION_ABSOLUTE_TIMEOUT_MS = hours(process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS, 12 * 60 * 60 * 1000);
const SESSION_TOUCH_INTERVAL_MS = minutes(process.env.SESSION_TOUCH_INTERVAL_MINUTES, 5 * 60 * 1000);

/*
 * The mobile app's sessions.
 *
 * A browser tab left for half an hour is a computer someone may have walked
 * away from, so the website signs out after 30 idle minutes. A phone is locked
 * and personal, and a parent who opens the app tomorrow to water the plant
 * expects to still be signed in — the 30-minute rule there means typing a
 * password every single day. So an app session idles out after 60 days and
 * ends after 180, and the token travels in the Authorization header: the app's
 * pages are on another origin, where the SameSite=Strict cookie never arrives.
 * Only customer accounts get one (see routes/auth.js); staff stay on the web.
 */
const APP_SESSION_IDLE_TIMEOUT_MS = days(process.env.APP_SESSION_IDLE_TIMEOUT_DAYS, 60 * 24 * 60 * 60 * 1000);
const APP_SESSION_ABSOLUTE_TIMEOUT_MS = days(process.env.APP_SESSION_ABSOLUTE_TIMEOUT_DAYS, 180 * 24 * 60 * 60 * 1000);

const isProd = process.env.NODE_ENV === 'production';
const sessionIdPattern = /^[a-z0-9]{20,40}$/i;

const isAppSession = (session) => session?.data?.client === 'app';
const idleTimeoutOf = (session) => (isAppSession(session) ? APP_SESSION_IDLE_TIMEOUT_MS : SESSION_IDLE_TIMEOUT_MS);

/*
 * Finding F-08. Two changes here:
 *
 * `secure` used to read `isProd` alone, so a deployment that forgot NODE_ENV
 * silently served the session cookie over plain HTTP. COOKIE_SECURE now makes
 * it explicit, still defaulting to isProd, and production refuses to start with
 * it switched off (see the check below) rather than quietly downgrading.
 *
 * The cookie is also signed now. The value is a random session id looked up in
 * the database, so forging one was never practical — but signing means a
 * tampered cookie is rejected at the parser instead of reaching a DB query, and
 * it costs nothing.
 */
const COOKIE_SECURE = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE !== 'false'
  : isProd;

if (isProd && !COOKIE_SECURE) {
  throw new Error(
    'COOKIE_SECURE=false in production would send the session cookie over plain HTTP.',
  );
}

export const sessionPlugin = fp(async (fastify) => {
  const setSessionCookie = (reply, sessionId, maxAgeMs) => {
    reply.setCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      signed: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: Math.max(1, Math.floor(maxAgeMs / 1000)),
    });
  };

  const clearSessionCookie = (reply) => {
    reply.clearCookie(SESSION_COOKIE, {
      path: '/',
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'Strict',
    });
  };

  /**
   * Signed cookies arrive as "<value>.<signature>" and must be unsigned before
   * use. An invalid or tampered signature yields no id, so the request is
   * simply treated as anonymous.
   */
  const readCookieSessionId = (req) => {
    const raw = req.cookies[SESSION_COOKIE];
    if (!raw) return null;
    const result = req.unsignCookie(raw);
    return result.valid ? result.value : null;
  };

  /** The app's token: the same signed session id, sent as `Authorization: Bearer`. */
  const readBearerSessionId = (req) => {
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
    const raw = header.slice(7).trim();
    if (!raw || raw.length > 200) return null;
    const result = req.unsignCookie(raw);
    return result.valid ? result.value : null;
  };

  const readSessionId = (req) => readCookieSessionId(req) || readBearerSessionId(req);

  /** The live session behind one credential, or null. Clears a dead cookie. */
  const resolveSession = async (sessionId, viaCookie, reply) => {
    if (!sessionIdPattern.test(sessionId)) {
      if (viaCookie) clearSessionCookie(reply);
      return null;
    }

    const session = await fastify.prisma.session.findFirst({
      where: { id: sessionId },
      include: {
        user: { select: { id: true, email: true, name: true, role: true, status: true, vipUntil: true, createdAt: true } },
      },
    });

    if (!session) {
      if (viaCookie) clearSessionCookie(reply);
      return null;
    }

    // An app token arriving as a cookie, or a website session as a bearer
    // token, is a credential used somewhere it was not issued for.
    if (isAppSession(session) === viaCookie) return null;

    const now = new Date();
    const idleExpiresAt = new Date(session.lastSeenAt.getTime() + idleTimeoutOf(session));
    const isExpired = session.expiresAt <= now || idleExpiresAt <= now;
    const isInactiveUser = !session.user || session.user.status !== 'active';

    if (isExpired || isInactiveUser) {
      await fastify.prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {});
      if (viaCookie) clearSessionCookie(reply);
      return null;
    }
    return session;
  };

  // Resolve user from the session cookie, or the app's bearer token, on every request
  fastify.addHook('preHandler', async (req, reply) => {
    req.user = null;
    req.session = null;

    // The cookie first, then the token: an app that once signed in on the
    // cookie (before it was given tokens) still holds that cookie in its
    // native jar, and a dead one must not hide a good token behind it.
    const cookieId = readCookieSessionId(req);
    let session = cookieId ? await resolveSession(cookieId, true, reply) : null;
    // A bearer request has no cookie to refresh or clear.
    const viaCookie = Boolean(session);
    if (!session) {
      const bearerId = readBearerSessionId(req);
      session = bearerId ? await resolveSession(bearerId, false, reply) : null;
    }
    if (!session) return;

    const now = new Date();
    const idleTimeoutMs = idleTimeoutOf(session);
    const idleExpiresAt = new Date(session.lastSeenAt.getTime() + idleTimeoutMs);

    const absoluteRemainingMs = session.expiresAt.getTime() - now.getTime();
    const idleRemainingMs = idleExpiresAt.getTime() - now.getTime();
    const cookieMaxAgeMs = Math.min(absoluteRemainingMs, idleRemainingMs);

    if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
      await fastify.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      }).catch(() => null);
      if (viaCookie) setSessionCookie(reply, session.id, Math.min(absoluteRemainingMs, idleTimeoutMs));
    } else if (viaCookie) {
      setSessionCookie(reply, session.id, cookieMaxAgeMs);
    }

    req.session = session;
    req.user = session.user;
  });

  /**
   * Creates a DB session. The website gets it as the session cookie; the app
   * (`client: 'app'`) gets it back as a token to send in the Authorization
   * header, with the app's longer lifetime and no cookie at all.
   */
  fastify.decorate('setSession', async (req, reply, userId, { client = 'web' } = {}) => {
    const existingSessionId = readSessionId(req);
    if (existingSessionId && sessionIdPattern.test(existingSessionId)) {
      await fastify.prisma.session.deleteMany({ where: { id: existingSessionId } }).catch(() => {});
    }

    const app = client === 'app';
    const now = new Date();
    const csrfToken = randomBytes(32).toString('hex');
    const session = await fastify.prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(now.getTime() + (app ? APP_SESSION_ABSOLUTE_TIMEOUT_MS : SESSION_ABSOLUTE_TIMEOUT_MS)),
        lastSeenAt: now,
        data: app ? { csrfToken, client: 'app' } : { csrfToken },
      },
    });

    if (app) return { csrfToken, token: fastify.signCookie(session.id) };

    setSessionCookie(reply, session.id, Math.min(SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_IDLE_TIMEOUT_MS));
    return { csrfToken };
  });

  // Deletes DB session and clears cookie. Cookie attributes must mirror those
  // set in setSession or some browsers (notably Safari) refuse the overwrite.
  fastify.decorate('clearSession', async (req, reply) => {
    const sessionId = req.session?.id || readSessionId(req);
    if (sessionId) {
      await fastify.prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {});
    }
    clearSessionCookie(reply);
  });

  // Cleanup expired sessions on startup, then every hour. The website's idle
  // rule must not reach app sessions, which idle out on their own clock.
  const cleanupExpired = () => {
    const now = new Date();
    const webIdleBefore = new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS);
    const appIdleBefore = new Date(now.getTime() - APP_SESSION_IDLE_TIMEOUT_MS);
    return fastify.prisma.$executeRaw`
      DELETE FROM "Session"
      WHERE "expiresAt" < ${now}
         OR "lastSeenAt" < ${appIdleBefore}
         OR ("lastSeenAt" < ${webIdleBefore} AND COALESCE("data"->>'client', 'web') <> 'app')
    `.catch(() => {});
  };

  let cleanupTimer = null;
  fastify.addHook('onReady', async () => {
    cleanupExpired();
    cleanupTimer = setInterval(cleanupExpired, 60 * 60 * 1000);
    cleanupTimer.unref?.();
  });

  fastify.addHook('onClose', async () => {
    if (cleanupTimer) clearInterval(cleanupTimer);
  });
});
