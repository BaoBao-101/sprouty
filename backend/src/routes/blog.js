import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { subscribeToBlogEvents } from '../services/blog-events.js';

function renderSafeContent(markdown) {
  const html = marked.parse(markdown || '', { async: false, breaks: true });
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3']),
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
  });
}

function dto(post, includeContent = false) {
  const base = {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    coverUrl: post.coverAsset?.url || null,
    recommendedProductIds: post.recommendedProductIds || [],
    status: post.status,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.author ? { id: post.author.id, name: post.author.name } : null,
  };
  if (includeContent) {
    base.content = post.content;
    base.contentHtml = renderSafeContent(post.content);
    base.recommendedProducts = post.recommendedProducts || [];
  }
  return base;
}

function selectProductDto(product) {
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    oldPrice: product.oldPrice,
    category: product.category,
    ageRange: product.ageRange,
    collection: product.collection,
    emoji: product.emoji,
    badge: product.badge,
    bgColor: product.bgColor,
    images: product.images || [],
    status: product.status,
  };
}

export default async function blogRoutes(fastify) {
  fastify.get('/blog', async (req, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || '10', 10)));
    const where = { status: 'published' };
    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [posts, total] = await Promise.all([
      fastify.prisma.blogPost.findMany({
        where,
        include: { coverAsset: true, author: { select: { id: true, name: true } } },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      fastify.prisma.blogPost.count({ where }),
    ]);
    return { posts: posts.map(p => dto(p)), page, limit, total };
  });

  fastify.get('/blog/:slug', async (req, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    const post = await fastify.prisma.blogPost.findFirst({
      where: { slug: req.params.slug, status: 'published' },
      include: { coverAsset: true, author: { select: { id: true, name: true } } },
    });
    if (!post) return reply.code(404).send({ message: 'Không tìm thấy bài viết.' });
    const productIds = post.recommendedProductIds || [];
    let recommendedProducts = [];
    if (productIds.length) {
      const products = await fastify.prisma.product.findMany({
        where: { id: { in: productIds }, status: 'published' },
      });
      const map = new Map(products.map(p => [p.id, selectProductDto(p)]));
      recommendedProducts = productIds.map(id => map.get(id)).filter(Boolean);
    }
    return { post: dto({ ...post, recommendedProducts }, true) };
  });

  fastify.get('/blog-events/stream', async (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write('retry: 3000\n\n');

    const unsubscribe = subscribeToBlogEvents((payload) => {
      reply.raw.write(`event: blog-updated\ndata: ${payload}\n\n`);
    });
    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 25000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
