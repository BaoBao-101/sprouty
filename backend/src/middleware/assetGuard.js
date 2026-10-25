import { AppError } from '../utils/errors.js';
import { canAccessProductFeature } from '../services/access.js';
import { verifyMediaToken } from '../services/media-token.js';

/*
 * Authorisation for the local-storage upload mount (`/uploads/*`) — finding F-02.
 *
 * Access control used to live only on the JSON metadata endpoints, so the files
 * themselves were world-readable: a Cây Kỷ Niệm leaf photo could be fetched with
 * no session at all. The random 16-byte object key made the URL unguessable but
 * not private — it is stable, permanent and credential-free, so it stays valid
 * for anyone it ever leaks to (shared link, Referer, proxy log, browser history).
 *
 * Every object key starts with its asset kind (see `safeObjectKey`), which is
 * what decides the rule below. Unknown kinds are denied, so a new kind is
 * private until someone deliberately lists it here.
 */

/** Kinds anyone may fetch — these are already shown on public pages. */
const PUBLIC_KINDS = new Set([
  'blog_cover',
  'blog_inline',
  'workshop_cover',
  // A product photo is the shop listing. It has to be readable by a visitor
  // who has not signed in, or the catalogue renders as broken images.
  'product_image',
]);

/** Kinds gated by the same entitlement as their metadata endpoint. */
const FEATURE_BY_KIND = {
  instruction_video: 'instruction_videos',
  instruction_video_thumb: 'instruction_videos',
};

/** Kinds only the uploading user (or staff) may fetch. */
const OWNER_ONLY_KINDS = new Set(['user_image']);

/**
 * The mobile app's `?mt=` pass (services/media-token.js), when there is no
 * session. It only stands in for who is asking; every rule below still applies.
 */
async function userFromMediaToken(req) {
  const userId = verifyMediaToken(req.query?.mt);
  if (!userId) return null;
  const user = await req.server.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true },
  });
  return user && user.status === 'active' ? user : null;
}

/**
 * preHandler for @fastify/static. Must run after the session plugin, otherwise
 * `req.user` is undefined and every private asset 401s.
 */
export async function assetAccessGuard(req) {
  // @fastify/static registers `GET <prefix>*`, so the wildcard is the object key.
  const key = req.params?.['*'];
  if (!key) throw new AppError('Không tìm thấy tệp.', 404);

  const kind = key.split('/')[0];
  if (PUBLIC_KINDS.has(kind)) return;

  if (!req.user && req.query?.mt) req.user = await userFromMediaToken(req);

  // A review photo is public once it is on a published review — that is what
  // the customer posted it for. Before that (an upload not sent yet), or after
  // an admin hid the review (perhaps for showing personal details), only its
  // owner and the admins may open it.
  if (kind === 'review_photo') {
    const prisma = req.server.prisma;
    const asset = await prisma.asset.findFirst({ where: { key }, select: { ownerUserId: true, url: true } });
    if (!asset) throw new AppError('Không tìm thấy tệp.', 404);
    const onShow = { where: { status: 'published', images: { has: asset.url } }, select: { id: true } };
    const [onProduct, onWorkshop] = await Promise.all([
      prisma.productReview.findFirst(onShow),
      prisma.workshopReview.findFirst(onShow),
    ]);
    if (onProduct || onWorkshop) return;
    if (req.user && (req.user.role === 'admin' || req.user.id === asset.ownerUserId)) return;
    if (!req.user) throw new AppError('Bạn cần đăng nhập để xem tệp này.', 401);
    throw new AppError('Bạn không có quyền xem tệp này.', 403);
  }

  if (!req.user) throw new AppError('Bạn cần đăng nhập để xem tệp này.', 401);
  // Only administrators moderate private media; employees only read the catalogue.
  if (req.user.role === 'admin') return;
  if (req.user.role !== 'customer') throw new AppError('Bạn không có quyền xem tệp này.', 403);

  const prisma = req.server.prisma;
  const asset = await prisma.asset.findFirst({
    where: { key },
    select: { ownerUserId: true, productId: true, kind: true, userProductImages: { select: { userId: true, status: true } } },
  });
  // A key with no Asset row is a stray file. 404 rather than 403 so probing
  // cannot distinguish "exists but forbidden" from "does not exist".
  if (!asset) throw new AppError('Không tìm thấy tệp.', 404);

  if (OWNER_ONLY_KINDS.has(kind)) {
    if (asset.ownerUserId === req.user.id && asset.userProductImages.some(image => image.userId === req.user.id && image.status === 'active')) return;
    throw new AppError('Bạn không có quyền xem tệp này.', 403);
  }

  const feature = FEATURE_BY_KIND[kind];
  if (feature) {
    const ok = await canAccessProductFeature(prisma, req.user, asset.productId, feature);
    if (ok) return;
    throw new AppError('Bạn chưa có quyền xem tệp này.', 403);
  }

  throw new AppError('Bạn không có quyền xem tệp này.', 403);
}
