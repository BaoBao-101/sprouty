import { z } from 'zod';
import { requireAuth, requireCsrf } from '../middleware/rbac.js';
import { AppError } from '../utils/errors.js';
import { intParam, multipartFields, noHtml, parseOrThrow } from '../utils/validation.js';
import { canAccessProductFeature, isVipUser } from '../services/access.js';
import { createAsset, maxLeafVideoBytes } from '../services/storage/index.js';

const updateSchema = z.object({
  title: noHtml('Tiêu đề').and(z.string().max(120)).optional().nullable(),
  note: noHtml('Ghi chú').and(z.string().max(1000)).optional().nullable(),
});

// Cây Kỷ Niệm caps leaves (photos/videos) per kit so storage doesn't grow
// unbounded — VIP (bought VIP Garden Monthly/Annual) gets a higher cap.
// Keep in sync with pages/tree.html and pages/my-products.html.
const MAX_LEAVES_STANDARD = 10;
const MAX_LEAVES_VIP = 25;

// Guards against accidental-upload spam: a user can remove (and re-upload
// a replacement) at most this many leaves per kit — soft-deleted rows are
// kept, so counting them doubles as the usage counter, no extra column.
const MAX_REMOVALS_PER_PRODUCT = 5;

async function maxLeavesFor(prisma, userId) {
  return (await isVipUser(prisma, userId)) ? MAX_LEAVES_VIP : MAX_LEAVES_STANDARD;
}

async function removalsUsedFor(prisma, userId, productId) {
  return prisma.userProductImage.count({
    where: { userId, productId, status: 'deleted' },
  });
}

function imageDto(row) {
  return {
    id: row.id,
    productId: row.productId,
    title: row.title,
    note: row.note,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    url: row.asset?.url,
    asset: row.asset,
  };
}

export default async function userImageRoutes(fastify) {
  fastify.get('/my-products/:productId/images', { preHandler: [requireAuth] }, async (req) => {
    const productId = intParam(req.params.productId, 'ID sản phẩm');
    const ok = await canAccessProductFeature(fastify.prisma, req.user, productId, 'image_uploads');
    if (!ok) throw new AppError('Bạn chưa có quyền quản lý ảnh cho sản phẩm này.', 403);
    const [images, maxLeaves, removalsUsed] = await Promise.all([
      fastify.prisma.userProductImage.findMany({
        where: { userId: req.user.id, productId, status: { not: 'deleted' } },
        include: { asset: true },
        orderBy: { createdAt: 'desc' },
      }),
      maxLeavesFor(fastify.prisma, req.user.id),
      removalsUsedFor(fastify.prisma, req.user.id, productId),
    ]);
    return {
      images: images.map(imageDto),
      maxLeaves,
      removalsUsed,
      removalsMax: MAX_REMOVALS_PER_PRODUCT,
    };
  });

  fastify.post('/my-products/:productId/images', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const productId = intParam(req.params.productId, 'ID sản phẩm');
    const ok = await canAccessProductFeature(fastify.prisma, req.user, productId, 'image_uploads');
    if (!ok) throw new AppError('Mua sản phẩm hoặc nhập mã để tải ảnh/video cho sản phẩm này.', 403);
    const maxLeaves = await maxLeavesFor(fastify.prisma, req.user.id);
    const existingCount = await fastify.prisma.userProductImage.count({
      where: { userId: req.user.id, productId, status: { not: 'deleted' } },
    });
    if (existingCount >= maxLeaves) {
      throw new AppError(`Cây đã đủ ${maxLeaves} lá kỷ niệm rồi — hãy xoá bớt ảnh/video cũ nếu muốn thêm mới.`, 409);
    }
    const { file, fields } = await multipartFields(req);
    const isVideo = (file?.mimetype || '').startsWith('video/');
    const category = isVideo ? 'video' : 'image';
    const asset = await createAsset(fastify.prisma, {
      ownerUserId: req.user.id,
      productId,
      kind: 'user_image',
      file,
      category,
      // Leaf videos are phone clips, not produced instructional content —
      // cap them well below the admin instruction-video limit.
      maxBytesOverride: isVideo ? maxLeafVideoBytes() : undefined,
    });
    const image = await fastify.prisma.userProductImage.create({
      data: {
        userId: req.user.id,
        productId,
        assetId: asset.id,
        title: fields.title ? String(fields.title).slice(0, 120) : null,
        note: fields.note ? String(fields.note).slice(0, 1000) : null,
      },
      include: { asset: true },
    });
    reply.code(201);
    return { image: imageDto(image) };
  });

  fastify.patch('/my-images/:imageId', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const parsed = parseOrThrow(updateSchema, req.body);
    const existing = await fastify.prisma.userProductImage.findFirst({
      where: { id: req.params.imageId, userId: req.user.id, status: { not: 'deleted' } },
    });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy ảnh.' });
    const image = await fastify.prisma.userProductImage.update({
      where: { id: existing.id },
      data: {
        title: parsed.title === undefined ? undefined : parsed.title || null,
        note: parsed.note === undefined ? undefined : parsed.note || null,
      },
      include: { asset: true },
    });
    return { image: imageDto(image) };
  });

  fastify.delete('/my-images/:imageId', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const existing = await fastify.prisma.userProductImage.findFirst({
      where: { id: req.params.imageId, userId: req.user.id, status: { not: 'deleted' } },
    });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy ảnh.' });
    const removalsUsed = await removalsUsedFor(fastify.prisma, req.user.id, existing.productId);
    if (removalsUsed >= MAX_REMOVALS_PER_PRODUCT) {
      throw new AppError(`Mỗi cây chỉ được gỡ tối đa ${MAX_REMOVALS_PER_PRODUCT} lần — bạn đã dùng hết lượt gỡ.`, 403);
    }
    const image = await fastify.prisma.userProductImage.update({
      where: { id: existing.id },
      data: { status: 'deleted' },
      include: { asset: true },
    });
    return { image: imageDto(image) };
  });
}
