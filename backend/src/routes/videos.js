import { z } from 'zod';
import { requireAuth, requireCsrf } from '../middleware/rbac.js';
import { AppError } from '../utils/errors.js';
import { intParam, parseOrThrow } from '../utils/validation.js';
import { canAccessProductFeature } from '../services/access.js';
import { usableAssetUrl } from '../services/storage/index.js';

const progressSchema = z.object({
  progressSec: z.number().int().min(0).max(24 * 60 * 60),
  completed: z.boolean().optional().default(false),
});

function publicVideo(video, progress = null) {
  return {
    id: video.id,
    productId: video.productId,
    title: video.title,
    description: video.description,
    durationSec: video.durationSec,
    thumbnailUrl: video.thumbnailAsset?.url || null,
    externalUrl: video.externalUrl || null,
    sortOrder: video.sortOrder,
    status: video.status,
    progress: progress ? {
      progressSec: progress.progressSec,
      completedAt: progress.completedAt,
      lastWatchedAt: progress.lastWatchedAt,
    } : null,
  };
}

export default async function videoRoutes(fastify) {
  fastify.get('/products/:productId/videos', { preHandler: [requireAuth] }, async (req) => {
    const productId = intParam(req.params.productId, 'ID sản phẩm');
    const canAccess = await canAccessProductFeature(fastify.prisma, req.user, productId, 'instruction_videos');
    if (!canAccess) {
      throw new AppError('Mua sản phẩm hoặc nhập mã để xem video hướng dẫn.', 403);
    }

    const videos = await fastify.prisma.instructionVideo.findMany({
      where: { productId, status: 'published' },
      include: { thumbnailAsset: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const progress = await fastify.prisma.userVideoProgress.findMany({
      where: { userId: req.user.id, videoId: { in: videos.map(v => v.id) } },
    });
    const byVideo = new Map(progress.map(p => [p.videoId, p]));
    return { videos: videos.map(v => publicVideo(v, byVideo.get(v.id))) };
  });

  fastify.get('/videos/:videoId', { preHandler: [requireAuth] }, async (req, reply) => {
    const video = await fastify.prisma.instructionVideo.findFirst({
      where: { id: req.params.videoId, status: 'published' },
      include: { asset: true, thumbnailAsset: true },
    });
    if (!video) return reply.code(404).send({ message: 'Không tìm thấy video.' });
    const canAccess = await canAccessProductFeature(fastify.prisma, req.user, video.productId, 'instruction_videos');
    if (!canAccess) throw new AppError('Bạn chưa có quyền xem video này.', 403);
    return {
      video: {
        ...publicVideo(video),
        url: video.externalUrl || await usableAssetUrl(video.asset),
      },
    };
  });

  fastify.post('/videos/:videoId/progress', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const parsed = parseOrThrow(progressSchema, req.body);
    const video = await fastify.prisma.instructionVideo.findFirst({
      where: { id: req.params.videoId, status: 'published' },
      select: { id: true, productId: true },
    });
    if (!video) return reply.code(404).send({ message: 'Không tìm thấy video.' });
    const canAccess = await canAccessProductFeature(fastify.prisma, req.user, video.productId, 'instruction_videos');
    if (!canAccess) throw new AppError('Bạn chưa có quyền cập nhật tiến độ video này.', 403);
    const progress = await fastify.prisma.userVideoProgress.upsert({
      where: { userId_videoId: { userId: req.user.id, videoId: video.id } },
      update: {
        progressSec: parsed.progressSec,
        completedAt: parsed.completed ? new Date() : undefined,
        lastWatchedAt: new Date(),
      },
      create: {
        userId: req.user.id,
        videoId: video.id,
        progressSec: parsed.progressSec,
        completedAt: parsed.completed ? new Date() : null,
      },
    });
    return { progress };
  });
}
