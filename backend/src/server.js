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
import blogRoutes from './routes/blog.js';
import adminUserRoutes from './routes/admin/users.js';
import adminProductRoutes from './routes/admin/products.js';
import adminOrderRoutes from './routes/admin/orders.js';
import adminStatsRoutes from './routes/admin/stats.js';
import adminWorkshopRoutes from './routes/admin/workshops.js';
import adminVideoRoutes from './routes/admin/videos.js';
import adminUserImageRoutes from './routes/admin/user-images.js';
import adminRedeemCodeRoutes from './routes/admin/redeem-codes.js';
import adminBlogRoutes from './routes/admin/blog.js';
import sepayWebhookRoutes from './routes/webhooks/sepay.js';

const isProd = process.env.NODE_ENV === 'production';

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

const app = Fastify({
  logger: { level: isProd ? 'warn' : 'info' },
  trustProxy: process.env.TRUST_PROXY === 'true',
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
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    let parsed;
    try { parsed = new URL(origin); } catch { return cb(new Error('Not allowed by CORS'), false); }
    const requestOrigin = parsed.origin;
    if (allowedOrigins.some(o => o === requestOrigin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'), false);
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

if ((process.env.ASSET_STORAGE_PROVIDER || 'local') === 'local') {
  await fs.mkdir(localUploadRoot(), { recursive: true });
  await app.register(fastifyStatic, {
    root: localUploadRoot(),
    prefix: (process.env.PUBLIC_ASSET_BASE_URL || '/uploads').replace(/\/?$/, '/'),
    decorateReply: false,
  });
}

// Database via Prisma
await app.register(prismaPlugin);

// Postgres-backed session layer
await app.register(sessionPlugin);

// Rate limiting (global defaults, routes can override)
await app.register(fastifyRateLimit, {
  max: 120,
  timeWindow: '1 minute',
  keyGenerator: (req) => {
    const fwd = req.headers['x-forwarded-for'];
    return fwd ? fwd.split(',')[0].trim() : req.ip;
  },
  errorResponseBuilder: () => ({ message: 'Quá nhiều yêu cầu. Thử lại sau 1 phút.' }),
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
await app.register(blogRoutes,         { prefix: '/api/v1'       });
await app.register(adminUserRoutes,    { prefix: '/api/v1/admin' });
await app.register(adminProductRoutes, { prefix: '/api/v1/admin' });
await app.register(adminOrderRoutes,   { prefix: '/api/v1/admin' });
await app.register(adminStatsRoutes,   { prefix: '/api/v1/admin' });
await app.register(adminWorkshopRoutes,{ prefix: '/api/v1/admin' });
await app.register(adminVideoRoutes,   { prefix: '/api/v1/admin' });
await app.register(adminUserImageRoutes,{ prefix: '/api/v1/admin' });
await app.register(adminRedeemCodeRoutes,{ prefix: '/api/v1/admin' });
await app.register(adminBlogRoutes,    { prefix: '/api/v1/admin' });
await app.register(sepayWebhookRoutes, { prefix: '/api/v1/webhooks' });

app.setErrorHandler(errorHandler);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
await app.listen({ port: PORT, host: HOST });
console.log(`🚀 Sprouty backend · http://${HOST}:${PORT}`);
