import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import users from './users.js';

async function request(prisma, method, url, payload) {
  const app = Fastify();
  app.decorate('prisma', prisma);
  app.addHook('preHandler', async req => {
    req.user = { id: 'actor', role: 'admin' };
    req.session = { data: { csrfToken: 'token' } };
  });
  await app.register(users);
  try { return await app.inject({ method, url, payload, headers: { 'x-csrf-token': 'token' } }); }
  finally { await app.close(); }
}

function database(target, activeAdmins = 2) {
  const events = [];
  const db = {
    events,
    async $transaction(fn, options) { assert.equal(options.isolationLevel, 'Serializable'); return fn(db); },
    user: {
      async findUnique() { return target; },
      async count() { return activeAdmins; },
      async update(args) { events.push(['update', args]); return { ...target, ...args.data }; },
    },
    session: { async deleteMany(args) { events.push(['sessions', args]); } },
    auditLog: { async create(args) { events.push(['audit', args]); } },
  };
  return db;
}

test('admin cannot disable or demote themselves', async () => {
  for (const payload of [{ role: 'customer' }, { status: 'disabled' }]) {
    const response = await request({}, 'PATCH', '/users/actor', payload);
    assert.equal(response.statusCode, 400);
  }
});

test('last active administrator is protected', async () => {
  const db = database({ id: 'target', role: 'admin', status: 'active' }, 1);
  assert.equal((await request(db, 'PATCH', '/users/target', { role: 'employee' })).statusCode, 400);
  assert.equal(db.events.length, 0);
});

test('changing role revokes sessions and records an audit event', async () => {
  const db = database({ id: 'target', role: 'employee', status: 'active' });
  assert.equal((await request(db, 'PATCH', '/users/target', { role: 'admin' })).statusCode, 200);
  assert.deepEqual(db.events.map(e => e[0]), ['update', 'audit', 'sessions']);
  assert.equal(db.events[2][1].where.userId, 'target');
});

test('active customer VIP is protected against switching to staff', async () => {
  const db = database({ id: 'target', role: 'customer', status: 'active', vipUntil: new Date(Date.now() + 86400000) });
  assert.equal((await request(db, 'PATCH', '/users/target', { role: 'admin' })).statusCode, 409);
  assert.equal(db.events.length, 0);
});

test('staff and disabled accounts cannot receive VIP', async () => {
  for (const target of [{ role: 'admin', status: 'active' }, { role: 'employee', status: 'active' }, { role: 'customer', status: 'disabled' }]) {
    assert.equal((await request(database(target), 'POST', '/users/target/grant-vip')).statusCode, 400);
  }
});

test('VIP revocation only cancels gifts and preserves paid purchases', async () => {
  const db = database({ id: 'target', role: 'customer', status: 'active' });
  db.order = { async updateMany(args) {
    assert.equal(args.where.note, 'admin.grant_vip');
    assert.equal(args.where.userId, 'target');
    return { count: 1 };
  } };
  const paidAt = new Date();
  db.orderItem = { async findMany() { return [{ qty: 1, product: { membershipDays: 30 }, order: { id: 'paid-purchase', paidAt } }]; } };
  assert.equal((await request(db, 'DELETE', '/users/target/grant-vip')).statusCode, 200);
  assert.equal(db.events.find(e => e[0] === 'update')[1].data.vipUntil.getTime(), paidAt.getTime() + 30 * 86400000);
});

test('concurrent account updates return a retryable conflict', async () => {
  const db = { async $transaction() { throw Object.assign(new Error('conflict'), { code: 'P2034' }); } };
  assert.equal((await request(db, 'PATCH', '/users/target', { role: 'employee' })).statusCode, 409);
});
