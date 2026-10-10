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

const cases = [
  ['orders', 'POST', '/orders', ['admin', 'employee']],
  ['plants', 'POST', '/me/plants/activate', ['admin', 'employee']],
  ['membership', 'POST', '/membership/checkout', ['admin', 'employee']],
  ['workshops', 'POST', '/workshops/register', ['admin', 'employee']],
  ['redeem', 'POST', '/redeem', ['admin', 'employee']],
  ['chat', 'POST', '/chat', ['admin', 'employee']],
  ['user-images', 'POST', '/my-products/test/images', ['admin', 'employee']],
  ['videos', 'POST', '/videos/test/progress', ['admin', 'employee']],
  ['admin/attendance', 'GET', '/attendance', ['admin', 'customer']],
  ['admin/orders', 'PATCH', '/orders/test/status', ['admin', 'customer']],
  ['admin/orders', 'POST', '/orders/test/mark-paid', ['employee', 'customer']],
  ['admin/products', 'POST', '/products', ['employee', 'customer']],
  ['admin/videos', 'POST', '/products/test/videos', ['employee', 'customer']],
  ['admin/blog', 'POST', '/blog', ['employee', 'customer']],
  ['admin/user-images', 'PATCH', '/user-images/test/status', ['employee', 'customer']],
  ['admin/users', 'GET', '/users', ['employee', 'customer']],
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
