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

// Leaves allowed per growth stage: null for an active VIP (no limit).

async function perStageFor(prisma, userId) {
  const vip = await isVipUser(prisma, userId);
  return { vip, perStage: leafLimit(vip) };
}

/**
 * Which photos make up this album: the plant's own, or — for a kit owned but
 * not yet activated — the ones saved before there was a plant.
 */
function albumWhere(userId, productId, plant) {
  return { userId, productId, plantId: plant ? plant.id : null };
}

/** Leaves already on one branch of the album; deleted ones free their place. */
function stageCount(db, scope, stage) {
  return db.userProductImage.count({
    where: { ...scope, stage: stage ?? null, status: { not: 'deleted' } },
  });
}

function stageFullMessage(perStage, label) {
  return `Chặng “${label || 'này'}” đã đủ ${perStage} lá kỷ niệm. Xoá bớt một lá cũ của chặng này, chọn chặng khác, hoặc nâng cấp VIP để thêm không giới hạn.`;
}

async function removalsUsedFor(prisma, scope) {
  return prisma.userProductImage.count({
    where: { ...scope, status: 'deleted' },
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

const plantSelect = { id: true, nickname: true, stage: true, stageProgress: true, health: true };

/**
 * The plant whose album this is.
 *
 * Each plant has its own album, and one account may grow the same kit more
 * than once, so the plant is named (?plant=<id>). Without it — an old link —
 * the kit's first plant is meant. A named plant must be this account's and
 * this kit's, or it is not found.
 */
async function plantFor(prisma, userId, productId, plantId) {
  if (plantId) {
    const plant = await prisma.virtualPlant.findFirst({
      where: { id: String(plantId), userId, productId },
      select: plantSelect,
    });
    if (!plant) throw new AppError('Không tìm thấy cây này.', 404);
    return plant;
  }
  return prisma.virtualPlant.findFirst({
    where: { userId, productId },
    orderBy: { activatedAt: 'asc' },
    select: plantSelect,
  });
}

export default async function userImageRoutes(fastify) {
  fastify.get('/my-products/:productId/images', { preHandler: [requireCustomer] }, async (req) => {
    const productId = intParam(req.params.productId, 'ID sản phẩm');
    const ok = await canAccessProductFeature(fastify.prisma, req.user, productId, 'image_uploads');
    if (!ok) throw new AppError('Bạn chưa có quyền quản lý ảnh cho sản phẩm này.', 403);
    const plant = await plantFor(fastify.prisma, req.user.id, productId, req.query.plant);
    const scope = albumWhere(req.user.id, productId, plant);
    const [images, limits, removalsUsed, product, siblings] = await Promise.all([
      fastify.prisma.userProductImage.findMany({
        where: { ...scope, status: { not: 'deleted' } },
        include: { asset: true },
        orderBy: { createdAt: 'desc' },
      }),
      perStageFor(fastify.prisma, req.user.id),
      removalsUsedFor(fastify.prisma, scope),
      fastify.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, speciesKey: true, category: true },
      }),
      // Every plant this account grows from the kit, so the album can switch.
      fastify.prisma.virtualPlant.findMany({
        where: { userId: req.user.id, productId },
        orderBy: { activatedAt: 'asc' },
        select: { id: true, nickname: true },
      }),
    ]);

    const species = speciesFor(product);
    return {
      images: images.map((row) => imageDto(row, product)),
      vip: limits.vip,
      leavesPerStage: limits.perStage,
      removalsUsed,
      removalsMax: null,
      // Everything the album needs to render itself as this plant's journey,
      // rather than as a generic grid of pictures.
      product: product ? { id: product.id, name: product.name } : null,
      plant,
      plants: siblings,
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
    const { perStage } = await perStageFor(fastify.prisma, req.user.id);
    const { file, fields } = await multipartFields(req);
    const requestedStage = fields.stage ? String(fields.stage) : null;
    if (requestedStage && !STAGES.some((stage) => stage.id === requestedStage)) {
      throw new AppError('Giai đoạn không hợp lệ.', 400);
    }
    // Preserve the selected photo stage; older clients default to the current stage.
    const [plant, product] = await Promise.all([
      plantFor(fastify.prisma, req.user.id, productId, req.query.plant),
      fastify.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, speciesKey: true, category: true },
      }),
    ]);
    const stage = requestedStage ?? plant?.stage ?? null;
    const scope = albumWhere(req.user.id, productId, plant);
    const label = stage ? stageLabel(stage, product) : null;
    // Checked before the file is stored, so a full branch costs no storage.
    if (perStage !== null && (await stageCount(fastify.prisma, scope, stage)) >= perStage) {
      throw new AppError(stageFullMessage(perStage, label), 409);
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
    // Counted again under a lock on this branch, so two uploads sent at once
    // cannot both take its last place.
    const lockKey = `leaf:${req.user.id}:${productId}:${plant?.id ?? '-'}:${stage ?? '-'}`;
    const image = await fastify.prisma.$transaction(async (tx) => {
      if (perStage !== null) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text`;
        if ((await stageCount(tx, scope, stage)) >= perStage) {
          throw new AppError(stageFullMessage(perStage, label), 409);
        }
      }
      return tx.userProductImage.create({
        data: {
          userId: req.user.id,
          productId,
          plantId: plant?.id ?? null,
          assetId: asset.id,
          title: fields.title ? String(fields.title).slice(0, 120) : null,
          note: fields.note ? String(fields.note).slice(0, 1000) : null,
          stage,
        },
        include: { asset: true },
      });
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
