import { requireAdmin } from '../../middleware/rbac.js';
import { AppError } from '../../utils/errors.js';
import { dashboardPeriod, fillRevenueDays, percentageChange } from '../../services/dashboard.js';

export default async function adminStatsRoutes(fastify) {
  fastify.get('/stats', { preHandler: [requireAdmin] }, async (req) => {
    const days = Number(req.query.days ?? 30);
    if (![7, 30, 90].includes(days)) throw new AppError('Khoảng thời gian phải là 7, 30 hoặc 90 ngày.', 400);
    const period = dashboardPeriod(days);
    const { start, end, previousStart, previousEnd } = period;
    const prisma = fastify.prisma;
    const commercial = { OR: [{ note: null }, { note: { not: 'admin.grant_vip' } }] };
    const createdInPeriod = { ...commercial, createdAt: { gte: start, lte: end } };
    const [money, daily, topProducts, orderCount, previousOrders, newCustomers, previousCustomers,
      ordersByStatus, recentOrders, customerCount, productCount, unpaidOrders, draftProducts, draftPosts,
      pendingBookings, upcomingWorkshops, activity] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          COALESCE(SUM(oi.qty::numeric * oi."unitPrice") FILTER (WHERE o."paidAt" >= ${start} AND o."paidAt" <= ${end}), 0)::double precision AS revenue,
          COALESCE(SUM(oi.qty::numeric * oi."unitPrice") FILTER (WHERE o."paidAt" >= ${previousStart} AND o."paidAt" <= ${previousEnd}), 0)::double precision AS "previousRevenue",
          COUNT(DISTINCT o.id) FILTER (WHERE o."paidAt" >= ${start} AND o."paidAt" <= ${end})::int AS "paidOrders",
          COUNT(DISTINCT o.id) FILTER (WHERE o."paidAt" >= ${previousStart} AND o."paidAt" <= ${previousEnd})::int AS "previousPaidOrders"
        FROM "Order" o JOIN "OrderItem" oi ON oi."orderId" = o.id
        WHERE o.status != 'cancelled' AND o."paidAt" >= ${previousStart} AND o."paidAt" <= ${end}
          AND o.note IS DISTINCT FROM 'admin.grant_vip'
      `,
      prisma.$queryRaw`
        SELECT to_char(o."paidAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS date,
          SUM(oi.qty::numeric * oi."unitPrice")::double precision AS revenue,
          COUNT(DISTINCT o.id)::int AS orders
        FROM "Order" o JOIN "OrderItem" oi ON oi."orderId" = o.id
        WHERE o.status != 'cancelled' AND o."paidAt" >= ${start} AND o."paidAt" <= ${end}
          AND o.note IS DISTINCT FROM 'admin.grant_vip'
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw`
        SELECT p.id::int AS id, p.name, SUM(oi.qty)::int AS qty,
          SUM(oi.qty::numeric * oi."unitPrice")::double precision AS revenue
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" JOIN "Product" p ON p.id = oi."productId"
        WHERE o.status != 'cancelled' AND o."paidAt" >= ${start} AND o."paidAt" <= ${end}
          AND o.note IS DISTINCT FROM 'admin.grant_vip'
        GROUP BY p.id, p.name ORDER BY revenue DESC, p.id ASC LIMIT 5
      `,
      prisma.order.count({ where: createdInPeriod }),
      prisma.order.count({ where: { ...commercial, createdAt: { gte: previousStart, lte: previousEnd } } }),
      prisma.user.count({ where: { role: 'customer', createdAt: { gte: start, lte: end } } }),
      prisma.user.count({ where: { role: 'customer', createdAt: { gte: previousStart, lte: previousEnd } } }),
      prisma.order.groupBy({ by: ['status'], where: createdInPeriod, _count: { _all: true } }),
      prisma.order.findMany({ where: createdInPeriod, take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, shippingName: true, total: true, status: true, paidAt: true, createdAt: true } }),
      prisma.user.count({ where: { role: 'customer' } }),
      prisma.product.count({ where: { status: 'published' } }),
      prisma.order.count({ where: { ...commercial, paidAt: null, status: { not: 'cancelled' } } }),
      prisma.product.count({ where: { status: 'draft' } }),
      prisma.blogPost.count({ where: { status: 'draft' } }),
      prisma.workshopRegistration.count({ where: { status: 'pending', workshop: { status: 'published', dateTime: { gte: end } } } }),
      prisma.workshop.findMany({ where: { status: 'published', dateTime: { gte: end } }, take: 4, orderBy: { dateTime: 'asc' },
        select: { id: true, title: true, dateTime: true, location: true, capacity: true,
          _count: { select: { registrations: { where: { status: { not: 'cancelled' } } } } } } }),
      prisma.auditLog.findMany({ take: 6, orderBy: { createdAt: 'desc' },
        select: { id: true, action: true, createdAt: true, actor: { select: { name: true } } } }),
    ]);
    const revenue = Number(money[0]?.revenue || 0);
    const paidOrders = Number(money[0]?.paidOrders || 0);
    const previousRevenue = Number(money[0]?.previousRevenue || 0);
    const previousPaidOrders = Number(money[0]?.previousPaidOrders || 0);
    const average = paidOrders ? revenue / paidOrders : 0;
    const previousAverage = previousPaidOrders ? previousRevenue / previousPaidOrders : 0;
    return {
      period: { ...period, timezone: 'Asia/Ho_Chi_Minh' }, updatedAt: end,
      metrics: {
        revenue: { value: revenue, previous: previousRevenue, change: percentageChange(revenue, previousRevenue) },
        orders: { value: orderCount, previous: previousOrders, change: percentageChange(orderCount, previousOrders) },
        customers: { value: newCustomers, previous: previousCustomers, change: percentageChange(newCustomers, previousCustomers) },
        average: { value: Math.round(average), previous: Math.round(previousAverage), change: percentageChange(average, previousAverage) },
      },
      overview: { customers: customerCount, products: productCount, paidOrders },
      attention: { unpaidOrders, draftProducts, draftPosts, pendingBookings },
      revenueByDay: fillRevenueDays(period, daily), topProducts,
      ordersByStatus: Object.fromEntries(ordersByStatus.map(row => [row.status, row._count._all])),
      recentOrders, upcomingWorkshops, activity,
    };
  });
}
