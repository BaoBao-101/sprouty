import { z } from 'zod';
import { requireAdmin, requireCsrf } from '../../middleware/rbac.js';
import { AppError } from '../../utils/errors.js';
import { intParam, multipartFields, noHtml, parseOrThrow } from '../../utils/validation.js';
import { auditLog } from '../../services/audit.js';
import { createAsset } from '../../services/storage/index.js';

// Only the first failing issue reaches the client, so every rule carries its own
// Vietnamese message — otherwise Zod's English default ("String must contain at
// least 2 character(s)") surfaces without naming the field at fault.
const videoSchema = z.object({
  title: noHtml('Tiêu đề').and(
    z.string()
      .min(2, 'Tiêu đề video phải có ít nhất 2 ký tự.')
      .max(200, 'Tiêu đề video tối đa 200 ký tự.'),
  ),
  description: noHtml('Mô tả').and(
    z.string().max(2000, 'Mô tả tối đa 2000 ký tự.'),
  ).optional().nullable(),
  durationSec: z.coerce.number({ invalid_type_error: 'Thời lượng phải là một số.' })
    .int('Thời lượng phải là số nguyên (giây).')
    .min(0, 'Thời lượng không được âm.')
    .max(86400, 'Thời lượng tối đa 24 giờ.')
    .optional().nullable(),
  sortOrder: z.coerce.number({ invalid_type_error: 'Thứ tự hiển thị phải là một số.' })
    .int('Thứ tự hiển thị phải là số nguyên.')
    .min(0, 'Thứ tự hiển thị không được âm.')
    .max(10000, 'Thứ tự hiển thị tối đa 10000.')
    .optional().default(0),
  status: z.enum(['draft', 'published', 'archived'], {
    errorMap: () => ({ message: 'Trạng thái phải là "draft", "published" hoặc "archived".' }),
  }).optional().default('draft'),
  externalUrl: z.string()
    .url('URL video không hợp lệ — phải bắt đầu bằng http:// hoặc https://.')
    .max(2048, 'URL video tối đa 2048 ký tự.')
    .optional().nullable().or(z.literal('')),
});

const updateVideoSchema = videoSchema.partial();

async function parseVideoRequest(req, allowFile = true) {
  if (req.isMultipart?.()) {
    const { file, fields } = await multipartFields(req);
    return { data: parseOrThrow(videoSchema, fields), file: allowFile ? file : null };
  }
  return { data: parseOrThrow(videoSchema, req.body), file: null };
}

export default async function adminVideoRoutes(fastify) {
  const auth = [requireAdmin, requireCsrf];

  fastify.get('/products/:productId/videos', { preHandler: [requireAdmin] }, async (req) => {
    const productId = intParam(req.params.productId, 'ID sản phẩm');
    const videos = await fastify.prisma.instructionVideo.findMany({
      where: { productId },
      include: { asset: true, thumbnailAsset: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return { videos };
  });

  fastify.post('/products/:productId/videos', { preHandler: auth }, async (req, reply) => {
    const productId = intParam(req.params.productId, 'ID sản phẩm');
    const product = await fastify.prisma.product.findUnique({ where: { id: productId } });
    if (!product) return reply.code(404).send({ message: 'Không tìm thấy sản phẩm.' });
    const { data, file } = await parseVideoRequest(req);
    if (!file && !data.externalUrl) throw new AppError('Cần upload video hoặc nhập URL video.', 400);
    const asset = file ? await createAsset(fastify.prisma, {
      ownerUserId: req.user.id,
      productId,
      kind: 'instruction_video',
      file,
      category: 'video',
    }) : null;
    const video = await fastify.prisma.instructionVideo.create({
      data: {
        productId,
        assetId: asset?.id || null,
        title: data.title,
        description: data.description || null,
        durationSec: data.durationSec || null,
        sortOrder: data.sortOrder,
        status: data.status,
        externalUrl: data.externalUrl || null,
        createdByUserId: req.user.id,
      },
      include: { asset: true, thumbnailAsset: true },
    });
    await auditLog(fastify.prisma, req.user.id, 'instruction_video.create', 'InstructionVideo', video.id, { productId });
    reply.code(201);
    return { video };
  });

  fastify.put('/videos/:videoId', { preHandler: auth }, async (req, reply) => {
    const existing = await fastify.prisma.instructionVideo.findUnique({ where: { id: req.params.videoId } });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy video.' });
    const parsed = parseOrThrow(updateVideoSchema, req.body);
    const video = await fastify.prisma.instructionVideo.update({
      where: { id: existing.id },
      data: {
        ...parsed,
        description: parsed.description === undefined ? undefined : parsed.description || null,
        durationSec: parsed.durationSec === undefined ? undefined : parsed.durationSec || null,
        externalUrl: parsed.externalUrl === undefined ? undefined : parsed.externalUrl || null,
        updatedByUserId: req.user.id,
      },
      include: { asset: true, thumbnailAsset: true },
    });
    await auditLog(fastify.prisma, req.user.id, 'instruction_video.update', 'InstructionVideo', video.id, parsed);
    return { video };
  });

  fastify.delete('/videos/:videoId', { preHandler: auth }, async (req, reply) => {
    const existing = await fastify.prisma.instructionVideo.findUnique({ where: { id: req.params.videoId } });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy video.' });
    const video = await fastify.prisma.instructionVideo.update({
      where: { id: existing.id },
      data: { status: 'archived', updatedByUserId: req.user.id },
    });
    await auditLog(fastify.prisma, req.user.id, 'instruction_video.archive', 'InstructionVideo', video.id, {});
    return { video };
  });

  fastify.post('/videos/:videoId/upload-thumbnail', { preHandler: auth }, async (req, reply) => {
    const video = await fastify.prisma.instructionVideo.findUnique({ where: { id: req.params.videoId } });
    if (!video) return reply.code(404).send({ message: 'Không tìm thấy video.' });
    const { file } = await multipartFields(req);
    const asset = await createAsset(fastify.prisma, {
      ownerUserId: req.user.id,
      productId: video.productId,
      kind: 'instruction_video_thumb',
      file,
      category: 'image',
    });
    const updated = await fastify.prisma.instructionVideo.update({
      where: { id: video.id },
      data: { thumbnailAssetId: asset.id, updatedByUserId: req.user.id },
      include: { asset: true, thumbnailAsset: true },
    });
    await auditLog(fastify.prisma, req.user.id, 'instruction_video.thumbnail', 'InstructionVideo', video.id, { assetId: asset.id });
    return { video: updated };
  });
}
