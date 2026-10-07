import { z } from 'zod';
import { AppError } from '../../utils/errors.js';
import { requireEmployee, requireCsrf, requireAdmin } from '../../middleware/rbac.js';
import { isSpeciesKey, speciesCatalog } from '../../services/plant-sim.js';

// Reject any string containing HTML angle brackets — defense-in-depth against stored XSS.
const noHtml = (label) => z.string().refine(
  s => !/[<>]/.test(s),
  { message: `${label} không được chứa ký tự < hoặc >.` }
);

// Every rule carries its own Vietnamese message. Only the first failing issue is
// returned to the client (see `parsed.error.errors[0]`), so a rule left without a
// message surfaces Zod's English default — e.g. "String must contain at least 2
// character(s)" — which does not tell the user which field to fix.
const productSchema = z.object({
  name: noHtml('Tên sản phẩm').and(
    z.string()
      .min(2, 'Tên sản phẩm phải có ít nhất 2 ký tự.')
      .max(200, 'Tên sản phẩm tối đa 200 ký tự.'),
  ),
  description: noHtml('Mô tả').and(
    z.string()
      .min(10, 'Mô tả phải có ít nhất 10 ký tự.')
      .max(5000, 'Mô tả tối đa 5000 ký tự.'),
  ),
  price: z.number({ invalid_type_error: 'Giá bán phải là một số.' })
    .int('Giá bán phải là số nguyên.')
    .positive('Giá bán phải lớn hơn 0.'),
  oldPrice: z.number({ invalid_type_error: 'Giá trước giảm phải là một số.' })
    .int('Giá trước giảm phải là số nguyên.')
    .positive('Giá trước giảm phải lớn hơn 0.')
    .nullable().optional(),
  smartPriceDelta: z.number({ invalid_type_error: 'Phụ phí Smart phải là một số.' })
    .int('Phụ phí Smart phải là số nguyên.')
    .positive('Phụ phí Smart phải lớn hơn 0.')
    .nullable().optional(),
  category: z.enum(['kit', 'book'], {
    errorMap: () => ({ message: 'Danh mục phải là "kit" hoặc "book".' }),
  }),
  // Which plant a kit grows in the simulation. Validated against the catalogue
  // rather than accepted as free text: an unknown key would not fail here, it
  // would fail weeks later as a customer's plant quietly growing the generic
  // species with the wrong harvest and the wrong stage names.
  speciesKey: z.string()
    .refine(isSpeciesKey, { message: 'Giống cây không hợp lệ.' })
    .nullable().optional(),
  ageRange: noHtml('Độ tuổi').and(
    z.string()
      .min(2, 'Độ tuổi phải có ít nhất 2 ký tự.')
      .max(50, 'Độ tuổi tối đa 50 ký tự.'),
  ),
  collection: noHtml('Bộ sưu tập').and(
    z.string()
      .min(2, 'Bộ sưu tập phải có ít nhất 2 ký tự.')
      .max(100, 'Bộ sưu tập tối đa 100 ký tự.'),
  ),
  emoji: z.string().max(8, 'Emoji tối đa 8 ký tự.').optional().default('🎨'),
  badge: z.enum(['hot', 'new', 'sale'], {
    errorMap: () => ({ message: 'Badge phải là "hot", "new" hoặc "sale".' }),
  }).nullable().optional(),
  bgColor: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Màu nền phải có dạng #RRGGBB, ví dụ #FEF5EA.')
    .optional().default('#FEF5EA'),
  includes: z.array(
    noHtml('Mục bao gồm').and(
      z.string()
        .min(1, 'Mục bao gồm không được để trống.')
        .max(300, 'Mỗi mục bao gồm tối đa 300 ký tự.'),
    ),
  ).max(40, 'Tối đa 40 mục bao gồm.').optional().default([]),
  // Image entries are interpolated into HTML `src` attributes on the client, so
  // constrain them to a real relative path or http(s) URL with no characters
  // that could break out of the attribute (quotes / angle brackets / spaces).
  images: z.array(
    z.string()
      .min(1, 'Đường dẫn ảnh không được để trống.')
      .max(2048, 'Đường dẫn ảnh tối đa 2048 ký tự.')
      .regex(
        /^(?:https?:\/\/|\/)[^\s"'<>]+$/,
        'Đường dẫn ảnh không hợp lệ — phải bắt đầu bằng / hoặc http(s):// và không chứa khoảng trắng.',
      ),
  ).max(20, 'Tối đa 20 ảnh.').optional().default([]),
  status: z.enum(['published', 'draft', 'archived'], {
    errorMap: () => ({ message: 'Trạng thái phải là "published", "draft" hoặc "archived".' }),
  }).optional().default('published'),
});

const updateProductSchema = productSchema.partial();

/**
 * `oldPrice` is rendered struck through next to `price`, so it only makes sense
 * above it. Nothing enforced that, and a product shipped with price 10.000đ and
 * oldPrice 8.000đ — the shop card showed a *rise* dressed up as a discount.
 *
 * This is a relationship between two fields, and PUT may send only one of them,
 * so it is checked against the merged record rather than inside the schema.
 */
function assertPriceOrder({ price, oldPrice }) {
  if (oldPrice === null || oldPrice === undefined) return;
  if (price === null || price === undefined) return;
  if (oldPrice <= price) {
    throw new AppError(
      `Giá trước giảm (${oldPrice.toLocaleString('vi-VN')}đ) phải lớn hơn giá bán (${price.toLocaleString('vi-VN')}đ). ` +
      'Đây là giá cũ hiển thị gạch ngang — để trống nếu sản phẩm không giảm giá.',
      400,
    );
  }
}

export default async function adminProductRoutes(fastify) {
  // Employees read the catalogue (they answer customer questions from it) but
  // only an admin owns it: creating a product sets a price, and deleting one
  // touches order history and the sales report — which is itself admin-only.
  const writeAuth = [requireAdmin, requireCsrf];

  // GET /api/v1/admin/products
  fastify.get('/products', { preHandler: [requireEmployee] }, async (req) => {
    const { status } = req.query;
    const where = status ? { status } : {};
    const products = await fastify.prisma.product.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    return { products };
  });

  // GET /api/v1/admin/products/sales — lifetime sold qty + revenue per product,
  // including products with zero sales. Cancelled orders are excluded.
  fastify.get('/products/sales', { preHandler: [requireAdmin] }, async () => {
    const rows = await fastify.prisma.$queryRaw`
      SELECT
        p.id::int AS "id",
        p.name AS "name",
        p.emoji AS "emoji",
        p.price::int AS "price",
        p.status AS "status",
        COALESCE(SUM(oi.qty) FILTER (WHERE o.status != 'cancelled'), 0)::int AS "totalQty",
        COALESCE(SUM(oi.qty * oi."unitPrice") FILTER (WHERE o.status != 'cancelled'), 0)::int AS "totalRevenue",
        COUNT(DISTINCT o.id) FILTER (WHERE o.status != 'cancelled')::int AS "orderCount"
      FROM "Product" p
      LEFT JOIN "OrderItem" oi ON oi."productId" = p.id
      LEFT JOIN "Order" o ON o.id = oi."orderId"
      GROUP BY p.id, p.name, p.emoji, p.price, p.status
      ORDER BY "totalQty" DESC, p.id ASC
    `;
    return { products: rows };
  });

  /**
   * A species only means something for a kit — it decides what the simulated
   * plant grows into. Carrying one on a book would be a field that reads as
   * configured but is never consulted, so it is cleared rather than stored.
   */
  function withSpeciesForCategory(data, effectiveCategory) {
    const category = effectiveCategory ?? data.category;
    if (category && category !== 'kit') return { ...data, speciesKey: null };
    return data;
  }

  // GET /api/v1/admin/products/species — what the product editor offers in its
  // species picker, including how each one's journey reads, so an admin can see
  // that a carrot says "Phình củ" where a tomato says "Ra nụ" before committing.
  fastify.get('/products/species', { preHandler: [requireEmployee] }, async () => ({
    species: speciesCatalog(),
  }));

  // POST /api/v1/admin/products
  fastify.post('/products', { preHandler: writeAuth }, async (req, reply) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.', 400);
    }

    assertPriceOrder(parsed.data);

    const product = await fastify.prisma.product.create({
      data: withSpeciesForCategory(parsed.data),
    });
    reply.code(201);
    return { product };
  });

  // PUT /api/v1/admin/products/:id
  fastify.put('/products/:id', { preHandler: writeAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return reply.code(400).send({ message: 'ID không hợp lệ.' });

    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.', 400);
    }

    const existing = await fastify.prisma.product.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy sản phẩm.' });

    // Check against the record as it will be, since a PUT may change only one
    // of the two prices.
    // Only when the request actually touches a price. Checking unconditionally
    // meant a product saved before this rule existed could not be edited at all
    // — renaming it failed with a price error it had nothing to do with. The
    // admin form always submits both prices, so any edit made through the UI is
    // still validated.
    if ('price' in parsed.data || 'oldPrice' in parsed.data) {
      assertPriceOrder({ ...existing, ...parsed.data });
    }

    const product = await fastify.prisma.product.update({
      where: { id },
      // The category may not be in this payload, so the existing one decides
      // whether a species still applies.
      data: withSpeciesForCategory(parsed.data, parsed.data.category ?? existing.category),
    });
    return { product };
  });

  // DELETE /api/v1/admin/products/:id
  fastify.delete('/products/:id', { preHandler: writeAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return reply.code(400).send({ message: 'ID không hợp lệ.' });

    const existing = await fastify.prisma.product.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy sản phẩm.' });

    // Archive instead of delete if there are orders
    const hasOrders = await fastify.prisma.orderItem.findFirst({ where: { productId: id } });
    if (hasOrders) {
      await fastify.prisma.product.update({ where: { id }, data: { status: 'archived' } });
      return { message: 'Sản phẩm đã được lưu trữ (có đơn hàng liên quan).' };
    }

    await fastify.prisma.product.delete({ where: { id } });
    return { message: 'Đã xóa sản phẩm.' };
  });
}
