import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { promises as fs } from 'fs';
import { prismaPlugin } from './plugins/prisma.js';
import { sessionPlugin } from './plugins/session.js';
import { errorHandler } from './utils/errors.js';
import { localUploadRoot } from './services/storage/localStorage.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import workshopRoutes from './routes/workshops.js';
import orderRoutes from './routes/orders.js';
import chatRoute from './routes/chat.js';
import videoRoutes from './routes/videos.js';
import userImageRoutes from './routes/user-images.js';
import redeemRoutes from './routes/redeem.js';
import plantRoutes from './routes/plants.js';
import blogRoutes from './routes/blog.js';
import adminUserRoutes from './routes/admin/users.js';
import adminProductRoutes from './routes/admin/products.js';
import adminOrderRoutes from './routes/admin/orders.js';
import adminStatsRoutes from './routes/admin/stats.js';
import adminWorkshopRoutes from './routes/admin/workshops.js';
import attendanceRoutes from './routes/admin/attendance.js';
import adminVideoRoutes from './routes/admin/videos.js';
import adminUserImageRoutes from './routes/admin/user-images.js';
import adminRedeemCodeRoutes from './routes/admin/redeem-codes.js';
import adminBlogRoutes from './routes/admin/blog.js';
import adminAuditRoutes from './routes/admin/audit.js';
import sepayWebhookRoutes from './routes/webhooks/sepay.js';
import { assetAccessGuard } from './middleware/assetGuard.js';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Where the uploaded-asset static mount lives, as a route path.
 *
 * PUBLIC_ASSET_BASE_URL does two jobs: it prefixes the URLs written into asset
 * records, and it was passed straight to @fastify/static as the mount prefix.
 * Those are only the same string when the API and the files share an origin.
 *
 * A split deployment — frontend on a CDN, API on its own host — has to set it to
 * a full URL like https://api.example.com/uploads so clients can resolve the
 * files. Fastify then refused the prefix at boot ("The first character of a path
 * should be / or *") and the whole server crash-looped, taking down an API that
 * had nothing to do with uploads.
 *
 * So the mount takes the path and nothing else. services/storage/localStorage.js
 * still uses the whole value for the URLs it hands out, which is the job that
 * actually needs the origin.
 */
function assetMountPath() {
  const raw = process.env.PUBLIC_ASSET_BASE_URL || '/uploads';
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      path = new URL(raw).pathname;
    } catch {
      path = '/uploads';
    }
  }
  if (!path.startsWith('/')) path = `/${path}`;
  // @fastify/static wants a trailing slash on the prefix.
  return path.replace(/\/?$/, '/');
}

if (isProd && !process.env.COOKIE_SECRET) {
  console.error('FATAL: COOKIE_SECRET must be set in production.');
  process.exit(1);
}

if (isProd) {
  for (const v of ['SEPAY_API_KEY', 'SEPAY_ACCOUNT_NUMBER', 'SEPAY_BANK_CODE']) {
    if (!process.env[v]) {
      console.error(`FATAL: ${v} must be set in production for SePay payments.`);
      process.exit(1);
    }
  }
}

// Trust only a bounded number of proxy hops. If we trusted every hop
// (trustProxy: true), the leftmost — client-supplied — X-Forwarded-For entry
// would become req.ip, letting an attacker forge it and rotate the rate-limit
// key to defeat brute-force protection. Bounding the hop count means req.ip is
// the address our own proxy appended (the real client).
//   unset / 'false' → no proxy, use the socket address
//   'true'          → exactly one reverse proxy (nginx) in front
//   '<n>'           → n proxy hops
//   '<ip|cidr|csv>' → trust that specific proxy address(es)
function resolveTrustProxy(v) {
  const s = (v || '').trim();
  if (s === '' || s === 'false') return false;
  if (s === 'true') return 1;
  const n = Number(s);
  if (Number.isInteger(n) && n >= 0) return n;
  return s;
}

const app = Fastify({
  logger: { level: isProd ? 'warn' : 'info' },
  trustProxy: resolveTrustProxy(process.env.TRUST_PROXY),
  bodyLimit: Number(process.env.BODY_LIMIT_MB || 25) * 1024 * 1024,
});

// Security headers
await app.register(fastifyHelmet, {
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
});

// CORS — same-origin in Docker (nginx handles it), explicit origins for local dev
const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost').split(',').map(s => s.trim());
await app.register(fastifyCors, {
  // Finding F-10: rejecting by passing an Error made @fastify/cors surface it as
  // a 500, which reads like the server fell over and invites someone to keep
  // poking. Refuse by simply not allowing the origin — the browser still blocks
  // the response for lack of the header, and the status stays honest.
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    let parsed;
    try { parsed = new URL(origin); } catch { return cb(null, false); }
    cb(null, allowedOrigins.some(o => o === parsed.origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
});

// Cookie parser (needed for session cookie reading)
const cookieSecret = process.env.COOKIE_SECRET
  || 'sprouty-dev-change-this-in-production-use-32-char-random-string';
if (!isProd && !process.env.COOKIE_SECRET) {
  console.warn('WARN: COOKIE_SECRET not set, using insecure development default.');
}
await app.register(fastifyCookie, { secret: cookieSecret });

await app.register(fastifyMultipart, {
  limits: {
    fileSize: Math.max(
      Number(process.env.MAX_IMAGE_UPLOAD_MB || 10),
      Number(process.env.MAX_VIDEO_UPLOAD_MB || 500),
    ) * 1024 * 1024,
    files: 1,
  },
});

// Database via Prisma
await app.register(prismaPlugin);

// Postgres-backed session layer
await app.register(sessionPlugin);

// Local uploaded assets. Registered *after* the session plugin on purpose:
// Fastify freezes a route's hook chain when the route is registered, so a static
// mount added earlier would never see the session preHandler and `req.user`
// would always be null inside assetAccessGuard.
if ((process.env.ASSET_STORAGE_PROVIDER || 'local') === 'local') {
  await fs.mkdir(localUploadRoot(), { recursive: true });
  // Wrapped in its own scope so the guard hook applies to the static route and
  // nothing else. @fastify/static takes no preHandler option of its own — it
  // would be accepted and silently ignored — and its `allowedPath` callback is
  // synchronous, so it cannot do the ownership lookup this needs.
  await app.register(async (scope) => {
    // F-02: private media (leaf photos, instruction videos) used to be readable
    // by anyone holding the URL. See middleware/assetGuard.js.
    scope.addHook('preHandler', assetAccessGuard);
    await scope.register(fastifyStatic, {
      root: localUploadRoot(),
      prefix: assetMountPath(),
      decorateReply: false,
    });
  });
}

// Rate limiting (global defaults, routes can override)
await app.register(fastifyRateLimit, {
  max: 120,
  timeWindow: '1 minute',
  // Key on req.ip, which Fastify derives from X-Forwarded-For using the bounded
  // trustProxy setting above — so it can't be spoofed by adding extra XFF hops.
  keyGenerator: (req) => req.ip,
  // The plugin throws this object; carry the status code (429, or 403 when
  // banning) so our error handler responds with it instead of a generic 500.
  errorResponseBuilder: (req, ctx) => ({
    statusCode: ctx.statusCode,
    error: ctx.statusCode === 403 ? 'Forbidden' : 'Too Many Requests',
    message: 'Quá nhiều yêu cầu. Thử lại sau 1 phút.',
  }),
});

// Health check
app.get('/api/v1/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  env: process.env.NODE_ENV || 'development',
}));

// API Routes
await app.register(authRoutes,         { prefix: '/api/v1/auth'  });
await app.register(productRoutes,      { prefix: '/api/v1'       });
await app.register(workshopRoutes,     { prefix: '/api/v1'       });
await app.register(orderRoutes,        { prefix: '/api/v1'       });
await app.register(chatRoute,          { prefix: '/api/v1'       });
await app.register(videoRoutes,        { prefix: '/api/v1'       });
await app.register(userImageRoutes,    { prefix: '/api/v1'       });
await app.register(redeemRoutes,       { prefix: '/api/v1'       });
await app.register(plantRoutes,        { prefix: '/api/v1'       });
await app.register(blogRoutes,         { prefix: '/api/v1'       });
await app.register(adminUserRoutes,    { prefix: '/api/v1/admin' });
await app.register(adminProductRoutes, { prefix: '/api/v1/admin' });
await app.register(adminOrderRoutes,   { prefix: '/api/v1/admin' });
await app.register(adminStatsRoutes,   { prefix: '/api/v1/admin' });
await app.register(adminWorkshopRoutes,{ prefix: '/api/v1/admin' });
await app.register(attendanceRoutes,   { prefix: '/api/v1/admin' });
await app.register(adminVideoRoutes,   { prefix: '/api/v1/admin' });
await app.register(adminUserImageRoutes,{ prefix: '/api/v1/admin' });
await app.register(adminRedeemCodeRoutes,{ prefix: '/api/v1/admin' });
await app.register(adminBlogRoutes,    { prefix: '/api/v1/admin' });
await app.register(adminAuditRoutes,   { prefix: '/api/v1/admin' });
await app.register(sepayWebhookRoutes, { prefix: '/api/v1/webhooks' });

app.setErrorHandler(errorHandler);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
await app.listen({ port: PORT, host: HOST });
console.log(`🚀 Sprouty backend · http://${HOST}:${PORT}`);
