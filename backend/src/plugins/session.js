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

const SESSION_IDLE_TIMEOUT_MS = minutes(process.env.SESSION_IDLE_TIMEOUT_MINUTES, 30 * 60 * 1000);
const SESSION_ABSOLUTE_TIMEOUT_MS = hours(process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS, 12 * 60 * 60 * 1000);
const SESSION_TOUCH_INTERVAL_MS = minutes(process.env.SESSION_TOUCH_INTERVAL_MINUTES, 5 * 60 * 1000);
const isProd = process.env.NODE_ENV === 'production';
const sessionIdPattern = /^[a-z0-9]{20,40}$/i;

export const sessionPlugin = fp(async (fastify) => {
  const setSessionCookie = (reply, sessionId, maxAgeMs) => {
    reply.setCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'Strict',
      path: '/',
      maxAge: Math.max(1, Math.floor(maxAgeMs / 1000)),
    });
  };

  const clearSessionCookie = (reply) => {
    reply.clearCookie(SESSION_COOKIE, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: 'Strict',
    });
  };

  // Resolve user from session cookie on every request
  fastify.addHook('preHandler', async (req, reply) => {
    req.user = null;
    req.session = null;

    const sessionId = req.cookies[SESSION_COOKIE];
    if (!sessionId) return;
    if (!sessionIdPattern.test(sessionId)) {
      clearSessionCookie(reply);
      return;
    }

    const session = await fastify.prisma.session.findFirst({
      where: { id: sessionId },
      include: {
        user: { select: { id: true, email: true, name: true, role: true, status: true } },
      },
    });

    if (!session) {
      clearSessionCookie(reply);
      return;
    }

    const now = new Date();
    const idleExpiresAt = new Date(session.lastSeenAt.getTime() + SESSION_IDLE_TIMEOUT_MS);
    const isExpired = session.expiresAt <= now || idleExpiresAt <= now;
    const isInactiveUser = !session.user || session.user.status !== 'active';

    if (isExpired || isInactiveUser) {
      await fastify.prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {});
      clearSessionCookie(reply);
      return;
    }

    const absoluteRemainingMs = session.expiresAt.getTime() - now.getTime();
    const idleRemainingMs = idleExpiresAt.getTime() - now.getTime();
    const cookieMaxAgeMs = Math.min(absoluteRemainingMs, idleRemainingMs);

    if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
      await fastify.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      }).catch(() => null);
      setSessionCookie(reply, session.id, Math.min(absoluteRemainingMs, SESSION_IDLE_TIMEOUT_MS));
    } else {
      setSessionCookie(reply, session.id, cookieMaxAgeMs);
    }

    req.session = session;
    req.user = session.user;
  });

  // Creates a DB session and sets the session cookie
  fastify.decorate('setSession', async (req, reply, userId) => {
    const existingSessionId = req.cookies[SESSION_COOKIE];
    if (existingSessionId && sessionIdPattern.test(existingSessionId)) {
      await fastify.prisma.session.deleteMany({ where: { id: existingSessionId } }).catch(() => {});
    }

    const now = new Date();
    const csrfToken = randomBytes(32).toString('hex');
    const session = await fastify.prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS),
        lastSeenAt: now,
        data: { csrfToken },
      },
    });

    setSessionCookie(reply, session.id, Math.min(SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_IDLE_TIMEOUT_MS));

    return { csrfToken };
  });

  // Deletes DB session and clears cookie. Cookie attributes must mirror those
  // set in setSession or some browsers (notably Safari) refuse the overwrite.
  fastify.decorate('clearSession', async (req, reply) => {
    const sessionId = req.cookies[SESSION_COOKIE];
    if (sessionId) {
      await fastify.prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {});
    }
    clearSessionCookie(reply);
  });

  // Cleanup expired sessions on startup, then every hour.
  const cleanupExpired = () =>
    fastify.prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { lastSeenAt: { lt: new Date(Date.now() - SESSION_IDLE_TIMEOUT_MS) } },
        ],
      },
    }).catch(() => {});

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
