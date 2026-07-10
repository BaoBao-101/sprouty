import { z } from 'zod';
import { requireEmployee, requireAdmin, requireCsrf } from '../../middleware/rbac.js';
import { AppError } from '../../utils/errors.js';
import { multipartFields, noHtml, parseOrThrow } from '../../utils/validation.js';
import { auditLog } from '../../services/audit.js';
import { createAsset } from '../../services/storage/index.js';
import { publishBlogEvent } from '../../services/blog-events.js';

const postSchema = z.object({
  title: noHtml('Tiêu đề').and(z.string().min(2).max(200)),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug không hợp lệ.').max(220).optional(),
  excerpt: noHtml('Tóm tắt').and(z.string().max(500)).optional().nullable(),
  content: z.string().min(1).max(100000),
  recommendedProductIds: z.array(z.number().int().positive()).max(12).optional().default([]),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
});

const updateSchema = postSchema.partial();
const statusSchema = z.object({ status: z.enum(['draft', 'published', 'archived']) });

function slugify(input) {
  return String(input || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200) || `post-${Date.now()}`;
}

async function uniqueSlug(prisma, preferred, ignoreId = null) {
  const base = slugify(preferred);
  let slug = base;
  let i = 2;
  while (await prisma.blogPost.findFirst({ where: { slug, id: ignoreId ? { not: ignoreId } : undefined } })) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

export default async function adminBlogRoutes(fastify) {
  function normalizeRecommendedProductIds(ids) {
    return [...new Set((ids || []).map(Number).filter(n => Number.isInteger(n) && n > 0))];
  }

  fastify.get('/blog', { preHandler: [requireEmployee] }, async (req) => {
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    const posts = await fastify.prisma.blogPost.findMany({
      where,
      include: { coverAsset: true, author: { select: { id: true, name: true, email: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return { posts };
  });

  fastify.post('/blog', { preHandler: [requireEmployee, requireCsrf] }, async (req, reply) => {
    const data = parseOrThrow(postSchema, req.body);
    const post = await fastify.prisma.blogPost.create({
      data: {
        title: data.title,
        slug: await uniqueSlug(fastify.prisma, data.slug || data.title),
        excerpt: data.excerpt || null,
        content: data.content,
        recommendedProductIds: normalizeRecommendedProductIds(data.recommendedProductIds),
        status: data.status,
        publishedAt: data.status === 'published' ? new Date() : null,
        authorUserId: req.user.id,
      },
    });
    await auditLog(fastify.prisma, req.user.id, 'blog.create', 'BlogPost', post.id, { status: post.status });
    publishBlogEvent({ action: 'created', postId: post.id, slug: post.slug, status: post.status });
    reply.code(201);
    return { post };
  });

  fastify.put('/blog/:id', { preHandler: [requireEmployee, requireCsrf] }, async (req, reply) => {
    const existing = await fastify.prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy bài viết.' });
    const data = parseOrThrow(updateSchema, req.body);
    const nextStatus = data.status || existing.status;
    const post = await fastify.prisma.blogPost.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        slug: data.slug !== undefined
          ? await uniqueSlug(fastify.prisma, data.slug, existing.id)
          : undefined,
        excerpt: data.excerpt === undefined ? undefined : data.excerpt || null,
        content: data.content,
        recommendedProductIds: data.recommendedProductIds === undefined
          ? undefined
          : normalizeRecommendedProductIds(data.recommendedProductIds),
        status: data.status,
        publishedAt: nextStatus === 'published' && !existing.publishedAt ? new Date() : undefined,
      },
    });
    await auditLog(fastify.prisma, req.user.id, 'blog.update', 'BlogPost', post.id, data);
    publishBlogEvent({ action: 'updated', postId: post.id, slug: post.slug, status: post.status });
    return { post };
  });

  fastify.patch('/blog/:id/status', { preHandler: [requireAdmin, requireCsrf] }, async (req, reply) => {
    const { status } = parseOrThrow(statusSchema, req.body);
    const existing = await fastify.prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy bài viết.' });
    const post = await fastify.prisma.blogPost.update({
      where: { id: existing.id },
      data: {
        status,
        publishedAt: status === 'published' && !existing.publishedAt ? new Date() : existing.publishedAt,
      },
    });
    await auditLog(fastify.prisma, req.user.id, `blog.${status}`, 'BlogPost', post.id, { previousStatus: existing.status });
    publishBlogEvent({ action: 'status-changed', postId: post.id, slug: post.slug, status: post.status });
    return { post };
  });

  fastify.delete('/blog/:id', { preHandler: [requireAdmin, requireCsrf] }, async (req, reply) => {
    const existing = await fastify.prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy bài viết.' });
    const post = await fastify.prisma.blogPost.update({
      where: { id: existing.id },
      data: { status: 'archived' },
    });
    await auditLog(fastify.prisma, req.user.id, 'blog.archive', 'BlogPost', post.id, {});
    publishBlogEvent({ action: 'archived', postId: post.id, slug: post.slug, status: post.status });
    return { post };
  });

  fastify.post('/blog/:id/cover', { preHandler: [requireEmployee, requireCsrf] }, async (req, reply) => {
    const post = await fastify.prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!post) return reply.code(404).send({ message: 'Không tìm thấy bài viết.' });
    const { file } = await multipartFields(req);
    const asset = await createAsset(fastify.prisma, {
      ownerUserId: req.user.id,
      kind: 'blog_cover',
      file,
      category: 'image',
    });
    const updated = await fastify.prisma.blogPost.update({
      where: { id: post.id },
      data: { coverAssetId: asset.id },
      include: { coverAsset: true },
    });
    await auditLog(fastify.prisma, req.user.id, 'blog.cover', 'BlogPost', post.id, { assetId: asset.id });
    publishBlogEvent({ action: 'cover-updated', postId: post.id, slug: post.slug, status: post.status });
    return { post: updated };
  });

  fastify.post('/blog-images', { preHandler: [requireEmployee, requireCsrf] }, async (req, reply) => {
    const { file } = await multipartFields(req);
    const asset = await createAsset(fastify.prisma, {
      ownerUserId: req.user.id,
      kind: 'blog_inline',
      file,
      category: 'image',
    });
    await auditLog(fastify.prisma, req.user.id, 'blog.image.upload', 'Asset', asset.id, {
      kind: asset.kind,
      originalName: asset.originalName,
    });
    reply.code(201);
    return {
      asset: {
        id: asset.id,
        url: asset.url,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      },
      markdown: `![${asset.originalName || 'Ảnh minh họa'}](${asset.url})`,
    };
  });
}
