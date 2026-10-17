import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { requireCustomer, requireEmployee, requireAdmin, requireStaff } from './rbac.js';
import { allowedOrderTransitions } from '../services/order-policy.js';
import { assetAccessGuard } from './assetGuard.js';

test('employee cannot bypass media permissions using a direct private asset URL', async () => {
  await assert.rejects(assetAccessGuard({ params: { '*': 'user_image/test.jpg' }, user: { role: 'employee' } }), { statusCode: 403 });
  await assetAccessGuard({ params: { '*': 'user_image/test.jpg' }, user: { role: 'admin' } });
});

test('a review photo is public only while it is on a published review', async () => {
  // published: 'product' or 'workshop' when a published review of that kind shows it.
  const req = (user, published) => ({
    params: { '*': 'review_photo/owner/abc.png' },
    user,
    server: { prisma: {
      asset: { findFirst: async () => ({ ownerUserId: 'owner', url: '/uploads/review_photo/owner/abc.png' }) },
      productReview: { findFirst: async () => (published === 'product' ? { id: 'r1' } : null) },
      workshopReview: { findFirst: async () => (published === 'workshop' ? { id: 'w1' } : null) },
    } },
  });
  await assetAccessGuard(req(null, 'product'));
  await assetAccessGuard(req(null, 'workshop'));
  await assert.rejects(assetAccessGuard(req(null, false)), { statusCode: 401 });
  await assert.rejects(assetAccessGuard(req({ id: 'other', role: 'customer' }, false)), { statusCode: 403 });
  await assert.rejects(assetAccessGuard(req({ id: 'staff', role: 'employee' }, false)), { statusCode: 403 });
  await assetAccessGuard(req({ id: 'owner', role: 'customer' }, false));
  await assetAccessGuard(req({ id: 'boss', role: 'admin' }, false));
});

test('roles are exclusive; shared staff access must be explicit', () => {
  for (const [guard, allowed] of [
    [requireCustomer, ['customer']], [requireEmployee, ['employee']],
    [requireAdmin, ['admin']], [requireStaff, ['employee', 'admin']],
  ]) {
    for (const role of [null, 'customer', 'employee', 'admin', 'unknown']) {
      let result;
      guard({ user: role ? { role } : null }, {}, err => { result = err; });
      assert.equal(result?.statusCode, allowed.includes(role) ? undefined : role ? 403 : 401);
    }
  }
});

test('delivery cannot skip steps, reopen terminal orders or ship unpaid orders', () => {
  assert.deepEqual(allowedOrderTransitions({ status: 'pending', paidAt: null }), ['cancelled']);
  assert.deepEqual(allowedOrderTransitions({ status: 'processing', paidAt: null }), []);
  assert.deepEqual(allowedOrderTransitions({ status: 'processing', paidAt: new Date() }), ['shipped']);
  assert.deepEqual(allowedOrderTransitions({ status: 'shipped', paidAt: new Date() }), ['delivered']);
  for (const status of ['delivered', 'cancelled']) {
    assert.deepEqual(allowedOrderTransitions({ status, paidAt: new Date() }), []);
  }
});

test('an order with nothing to post is completed, not "shipped"', () => {
  const previous = process.env.PHYSICAL_CATEGORIES;
  try {
    const paid = { status: 'processing', paidAt: new Date() };
    const kit = { ...paid, items: [{ product: { category: 'kit' } }] };
    const vip = { ...paid, items: [{ product: { category: 'membership' } }] };

    process.env.PHYSICAL_CATEGORIES = 'kit';
    assert.deepEqual(allowedOrderTransitions(kit), ['shipped']);
    assert.deepEqual(allowedOrderTransitions(vip), ['delivered']);

    process.env.PHYSICAL_CATEGORIES = '';
    assert.deepEqual(allowedOrderTransitions(kit), ['delivered']);
    // Unpaid stays unpaid whatever is in it.
    assert.deepEqual(allowedOrderTransitions({ ...vip, paidAt: null }), []);
  } finally {
    process.env.PHYSICAL_CATEGORIES = previous;
  }
});

const cases = [
  ['orders', 'POST', '/orders', ['admin', 'employee']],
  ['plants', 'POST', '/me/plants/activate', ['admin', 'employee']],
  ['membership', 'POST', '/membership/checkout', ['admin', 'employee']],
  ['workshops', 'POST', '/workshops/register', ['admin', 'employee']],
  ['redeem', 'POST', '/redeem', ['admin', 'employee']],
  ['chat', 'POST', '/chat', ['admin', 'employee']],
  ['user-images', 'POST', '/my-products/test/images', ['admin', 'employee']],
  ['videos', 'POST', '/videos/test/progress', ['admin', 'employee']],
  ['reviews', 'POST', '/me/reviews', ['admin', 'employee']],
  ['reviews', 'GET', '/me/reviews', ['admin', 'employee']],
  ['reviews', 'POST', '/me/review-images', ['admin', 'employee']],
  ['reviews', 'GET', '/me/workshop-reviews', ['admin', 'employee']],
  ['reviews', 'POST', '/me/workshop-reviews', ['admin', 'employee']],
  ['reviews', 'PATCH', '/me/workshop-reviews/test', ['admin', 'employee']],
  ['reviews', 'DELETE', '/me/workshop-reviews/test', ['admin', 'employee']],
  ['admin/attendance', 'GET', '/attendance/mine', ['admin', 'customer']],
  ['admin/orders', 'PATCH', '/orders/test/status', ['admin', 'customer']],
  ['admin/orders', 'POST', '/orders/test/mark-paid', ['employee', 'customer']],
  ['admin/products', 'POST', '/products', ['employee', 'customer']],
  ['admin/videos', 'POST', '/products/test/videos', ['employee', 'customer']],
  ['admin/blog', 'POST', '/blog', ['employee', 'customer']],
  ['admin/user-images', 'PATCH', '/user-images/test/status', ['employee', 'customer']],
  ['admin/users', 'GET', '/users', ['employee', 'customer']],
  ['admin/reviews', 'GET', '/reviews', ['employee', 'customer']],
  ['admin/reviews', 'PATCH', '/reviews/test/reply', ['employee', 'customer']],
  ['admin/reviews', 'PATCH', '/reviews/test/status', ['employee', 'customer']],
  ['admin/reviews', 'GET', '/workshop-reviews', ['employee', 'customer']],
  ['admin/reviews', 'PATCH', '/workshop-reviews/test/reply', ['employee', 'customer']],
  ['admin/reviews', 'PATCH', '/workshop-reviews/test/status', ['employee', 'customer']],
];

for (const [module, method, url, denied] of cases) {
  test(`${method} ${module}:${url} denies other roles before accessing data`, async () => {
    const app = Fastify();
    app.addHook('preHandler', async req => {
      req.user = req.headers['x-test-role'] ? { id: 'test', role: req.headers['x-test-role'] } : null;
      req.session = { data: { csrfToken: 'test-token' } };
    });
    app.decorate('prisma', {});
    await app.register((await import(`../routes/${module}.js`)).default);
    try {
      for (const role of [null, ...denied]) {
        const response = await app.inject({ method, url, headers: {
          ...(role ? { 'x-test-role': role } : {}), 'x-csrf-token': 'test-token',
        } });
        assert.equal(response.statusCode, role ? 403 : 401, response.body);
      }
    } finally { await app.close(); }
  });
}
