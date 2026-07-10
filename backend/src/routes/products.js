export default async function productRoutes(fastify) {
  // GET /api/v1/products
  fastify.get('/products', async (req) => {
    const { category, search, badge } = req.query;
    const where = { status: 'published' };
    if (category) where.category = category;
    if (badge) where.badge = badge;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { collection: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await fastify.prisma.product.findMany({
      where,
      orderBy: [{ badge: 'asc' }, { id: 'asc' }],
    });

    return { products };
  });

  // GET /api/v1/products/:id
  fastify.get('/products/:id', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return reply.code(400).send({ message: 'ID không hợp lệ.' });

    const product = await fastify.prisma.product.findFirst({
      where: { id, status: 'published' },
    });

    if (!product) return reply.code(404).send({ message: 'Không tìm thấy sản phẩm.' });
    return { product };
  });
}
