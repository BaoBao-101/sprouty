import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import statsRoutes from './stats.js';

async function setup(role = 'admin') {
  const queries = [];
  const db = {
    async $queryRaw(strings) {
      const query = strings.join('?');
      queries.push(query);
      assert.match(query, /paidAt/);
      assert.match(query, /status != 'cancelled'/);
      assert.match(query, /note IS DISTINCT FROM 'admin.grant_vip'/);
      if (query.includes('previousRevenue')) return [{ revenue: 300000, previousRevenue: 150000, paidOrders: 2, previousPaidOrders: 1 }];
      return [];
    },
    order: { count: async () => 2, groupBy: async () => [{ status: 'processing', _count: { _all: 2 } }], findMany: async () => [] },
    user: { count: async () => 1 }, product: { count: async () => 3 }, blogPost: { count: async () => 0 },
    workshopRegistration: { count: async () => 0 }, workshop: { findMany: async () => [] }, auditLog: { findMany: async () => [] },
  };
  const app = Fastify();
  app.decorate('prisma', db);
  app.addHook('preHandler', async req => { req.user = role ? { role } : null; });
  await app.register(statsRoutes);
  return { app, queries };
}
test('dashboard response includes complete series, comparison and independent queues', async () => {
  const { app, queries } = await setup();
  try {
    const result = await app.inject('/stats?days=30');
    assert.equal(result.statusCode, 200, result.body);
    const data = result.json();
    assert.equal(data.revenueByDay.length, 30);
    assert.deepEqual(data.metrics.revenue, { value: 300000, previous: 150000, change: 100 });
    assert.equal(data.metrics.average.value, 150000);
    assert.equal(data.attention.unpaidOrders, 2);
    assert.equal(data.ordersByStatus.processing, 2);
    assert.equal(queries.length, 3);
  } finally { await app.close(); }
});
test('unsupported ranges reject before querying the database', async () => {
  const { app, queries } = await setup();
  try {
    for (const days of ['0', '-1', '100000', 'abc']) assert.equal((await app.inject(`/stats?days=${days}`)).statusCode, 400);
    assert.equal(queries.length, 0);
  } finally { await app.close(); }
});
test('dashboard is admin-only', async () => {
  for (const role of ['employee', 'customer', null]) {
    const { app, queries } = await setup(role);
    try {
      assert.equal((await app.inject('/stats')).statusCode, role ? 403 : 401);
      assert.equal(queries.length, 0);
    } finally { await app.close(); }
  }
});
