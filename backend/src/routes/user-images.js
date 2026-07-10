import { z } from 'zod';
import { requireAuth, requireCsrf } from '../middleware/rbac.js';
import { AppError } from '../utils/errors.js';
import { intParam, multipartFields, noHtml, parseOrThrow } from '../utils/validation.js';
import { canAccessProductFeature } from '../services/access.js';
import { createAsset } from '../services/storage/index.js';

const updateSchema = z.object({
  title: noHtml('Tiêu đề').and(z.string().max(120)).optional().nullable(),
  note: noHtml('Ghi chú').and(z.string().max(1000)).optional().nullable(),
});

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
    const images = await fastify.prisma.userProductImage.findMany({
      where: { userId: req.user.id, productId, status: { not: 'deleted' } },
      include: { asset: true },
      orderBy: { createdAt: 'desc' },
    });
    return { images: images.map(imageDto) };
  });

  fastify.post('/my-products/:productId/images', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const productId = intParam(req.params.productId, 'ID sản phẩm');
    const ok = await canAccessProductFeature(fastify.prisma, req.user, productId, 'image_uploads');
    if (!ok) throw new AppError('Mua sản phẩm hoặc nhập mã để tải ảnh cho sản phẩm này.', 403);
    const { file, fields } = await multipartFields(req);
    const asset = await createAsset(fastify.prisma, {
      ownerUserId: req.user.id,
      productId,
      kind: 'user_image',
      file,
      category: 'image',
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
    const image = await fastify.prisma.userProductImage.update({
      where: { id: existing.id },
      data: { status: 'deleted' },
      include: { asset: true },
    });
    return { image: imageDto(image) };
  });
}
