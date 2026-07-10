import fp from 'fastify-plugin';
import { randomBytes } from 'crypto';

const SESSION_COOKIE = 'session_id';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const isProd = process.env.NODE_ENV === 'production';

export const sessionPlugin = fp(async (fastify) => {
  // Resolve user from session cookie on every request
  fastify.addHook('preHandler', async (req) => {
    req.user = null;
    req.session = null;

    const sessionId = req.cookies[SESSION_COOKIE];
    if (!sessionId) return;

    const session = await fastify.prisma.session.findFirst({
      where: { id: sessionId, expiresAt: { gt: new Date() } },
      include: {
        user: { select: { id: true, email: true, name: true, role: true, status: true } },
      },
    });

    if (session && session.user && session.user.status === 'active') {
      req.session = session;
      req.user = session.user;
    }
  });

  // Creates a DB session and sets the session cookie
  fastify.decorate('setSession', async (reply, userId) => {
    const csrfToken = randomBytes(32).toString('hex');
    const session = await fastify.prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
        data: { csrfToken },
      },
    });

    reply.setCookie(SESSION_COOKIE, session.id, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'Strict',
      path: '/',
      maxAge: SESSION_DURATION_MS / 1000,
    });

    return { csrfToken };
  });

  // Deletes DB session and clears cookie. Cookie attributes must mirror those
  // set in setSession or some browsers (notably Safari) refuse the overwrite.
  fastify.decorate('clearSession', async (req, reply) => {
    const sessionId = req.cookies[SESSION_COOKIE];
    if (sessionId) {
      await fastify.prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {});
    }
    reply.clearCookie(SESSION_COOKIE, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: 'Strict',
    });
  });

  // Cleanup expired sessions on startup, then every hour.
  const cleanupExpired = () =>
    fastify.prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});

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
