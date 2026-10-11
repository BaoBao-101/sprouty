import { z } from 'zod';
import { leafLimit } from '../services/benefits.js';
import { requireCustomer, requireCsrf } from '../middleware/rbac.js';
import { AppError } from '../utils/errors.js';
import { intParam, multipartFields, noHtml, parseOrThrow } from '../utils/validation.js';
import { canAccessProductFeature, isVipUser } from '../services/access.js';
import { STAGES, speciesFor, stageLabel } from '../services/plant-sim.js';
import { createAsset, maxLeafVideoBytes } from '../services/storage/index.js';
import { albumFormat } from '../services/storage/album-formats.js';

const updateSchema = z.object({
  title: noHtml('Tiêu đề').and(z.string().max(120)).optional().nullable(),
  note: noHtml('Ghi chú').and(z.string().max(1000)).optional().nullable(),
});

// The shared leafLimit policy returns null for unlimited active VIP albums.

async function maxLeavesFor(prisma, userId) {
  return leafLimit(await isVipUser(prisma, userId));
}

async function removalsUsedFor(prisma, userId, productId) {
  return prisma.userProductImage.count({
    where: { userId, productId, status: 'deleted' },
  });
}

/**
 * The product is passed so the stage can be named the way this species names
 * it — a carrot's album says "Phình củ" where a tomato's says "Ra nụ".
 */
export function imageDto(row, product = null) {
  return {
    id: row.id,
    productId: row.productId,
    title: row.title,
    note: row.note,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    url: row.status === 'active' ? row.asset?.url : null,
    asset: row.status === 'active' ? row.asset : null,
    stage: row.stage,
    stageLabel: row.stage ? stageLabel(row.stage, product) : null,
  };
}

/**
 * The plant this customer is growing from this product, if any.
 *
 * The album hangs off a product id rather than a plant id — it predates
 * virtual plants — so the plant is looked up rather than passed in.
 */
async function plantFor(prisma, userId, productId) {
  return prisma.virtualPlant.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true, nickname: true, stage: true, stageProgress: true, health: true },
  });
}

export default async function userImageRoutes(fastify) {
  fastify.get('/my-products/:productId/images', { preHandler: [requireCustomer] }, async (req) => {
    const productId = intParam(req.params.productId, 'ID sản phẩm');
    const ok = await canAccessProductFeature(fastify.prisma, req.user, productId, 'image_uploads');
    if (!ok) throw new AppError('Bạn chưa có quyền quản lý ảnh cho sản phẩm này.', 403);
    const [images, maxLeaves, removalsUsed, product, plant] = await Promise.all([
      fastify.prisma.userProductImage.findMany({
        where: { userId: req.user.id, productId, status: { not: 'deleted' } },
        include: { asset: true },
        orderBy: { createdAt: 'desc' },
      }),
      maxLeavesFor(fastify.prisma, req.user.id),
      removalsUsedFor(fastify.prisma, req.user.id, productId),
      fastify.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, speciesKey: true, category: true },
      }),
      plantFor(fastify.prisma, req.user.id, productId),
    ]);

    const species = speciesFor(product);
    return {
      images: images.map((row) => imageDto(row, product)),
      maxLeaves,
      removalsUsed,
      removalsMax: null,
      // Everything the album needs to render itself as this plant's journey,
      // rather than as a generic grid of pictures.
      product: product ? { id: product.id, name: product.name } : null,
      plant,
      species: {
        key: species.key,
        label: species.label,
        harvest: species.harvest,
        form: species.form,
        fruitShape: species.fruitShape,
        fruitColor: species.fruitColor,
        flowerColor: species.flowerColor,
      },
      stages: STAGES.map((stage) => ({
        id: stage.id,
        label: stageLabel(stage.id, product),
        icon: stage.icon,
      })),
    };
  });

  fastify.post('/my-products/:productId/images', { preHandler: [requireCustomer, requireCsrf] }, async (req, reply) => {
    const productId = intParam(req.params.productId, 'ID sản phẩm');
    const ok = await canAccessProductFeature(fastify.prisma, req.user, productId, 'image_uploads');
    if (!ok) throw new AppError('Mua sản phẩm hoặc nhập mã để tải ảnh/video cho sản phẩm này.', 403);
    const maxLeaves = await maxLeavesFor(fastify.prisma, req.user.id);
    const existingCount = await fastify.prisma.userProductImage.count({
      where: { userId: req.user.id, productId, status: { not: 'deleted' } },
    });
    if (maxLeaves !== null && existingCount >= maxLeaves) {
      throw new AppError(`Cây đã đủ ${maxLeaves} lá kỷ niệm rồi — hãy xoá bớt ảnh/video cũ nếu muốn thêm mới.`, 409);
    }
    const { file, fields } = await multipartFields(req);
    const requestedStage = fields.stage ? String(fields.stage) : null;
    if (requestedStage && !STAGES.some((stage) => stage.id === requestedStage)) {
      throw new AppError('Giai đoạn không hợp lệ.', 400);
    }
    const format = albumFormat(file?.filename, file?.mimetype);
    const isVideo = (format?.[0] || file?.mimetype || '').startsWith('video/');
    const category = isVideo ? 'video' : 'image';
    const asset = await createAsset(fastify.prisma, {
      ownerUserId: req.user.id,
      productId,
      kind: 'user_image',
      file,
      category,
      albumMedia: true,
      // Leaf videos are phone clips, not produced instructional content —
      // cap them well below the admin instruction-video limit.
      maxBytesOverride: isVideo ? maxLeafVideoBytes() : undefined,
    });
    // Preserve the selected photo stage; older clients default to the current stage.
    const [plant, product] = await Promise.all([
      plantFor(fastify.prisma, req.user.id, productId),
      fastify.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, speciesKey: true, category: true },
      }),
    ]);

    const image = await fastify.prisma.userProductImage.create({
      data: {
        userId: req.user.id,
        productId,
        assetId: asset.id,
        title: fields.title ? String(fields.title).slice(0, 120) : null,
        note: fields.note ? String(fields.note).slice(0, 1000) : null,
        stage: requestedStage ?? plant?.stage ?? null,
      },
      include: { asset: true },
    });
    reply.code(201);
    return { image: imageDto(image, product) };
  });

  fastify.patch('/my-images/:imageId', { preHandler: [requireCustomer, requireCsrf] }, async (req, reply) => {
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

  fastify.delete('/my-images/:imageId', { preHandler: [requireCustomer, requireCsrf] }, async (req, reply) => {
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
