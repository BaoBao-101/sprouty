import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import routes, { imageJourney } from './user-images.js';
import { imageDto } from '../user-images.js';
import { assetAccessGuard } from '../../middleware/assetGuard.js';

function database(status = 'active') {
  const events = [];
  const record = { id: 'image', userId: 'owner', productId: 1, status, stage: 'seed', product: { id: 1, name: 'Carrot', speciesKey: 'carrot', category: 'kit' } };
  const db = {
    events,
    async $transaction(fn) { return fn(db); },
    userProductImage: {
      async findUnique() { return record; },
      async updateMany(args) { events.push(['update', args]); return { count: 1 }; },
      async count() { return 21; },
      async groupBy() { return [{ status: 'active', _count: { _all: 21 } }]; },
      async findMany(args) { events.push(['list', args]); return [record]; },
    },
    virtualPlant: { async findMany(args) { events.push(['plants', args]); return [{ id: 'plant', userId: 'owner', productId: 1, nickname: 'Cà rốt của bé', stage: 'mature' }]; } },
    auditLog: { async create(args) { events.push(['audit', args]); } },
  };
  return db;
}
async function request(db, method, url, body) {
  const app = Fastify();
  app.decorate('prisma', db);
  app.addHook('preHandler', async req => { req.user = { id: 'admin', role: 'admin' }; req.session = { data: { csrfToken: 'token' } }; });
  await app.register(routes);
  try { return await app.inject({ method, url, payload: body, headers: { 'x-csrf-token': 'token' } }); }
  finally { await app.close(); }
}
test('gallery has 10 items per page and joins plants by owner/product pair', async () => {
  const db = database();
  const response = await request(db, 'GET', '/user-images?page=2');
  assert.equal(response.statusCode, 200, response.body);
  const data = response.json();
  assert.equal(data.limit, 10); assert.equal(data.pages, 3);
  assert.equal(data.images[0].plant.nickname, 'Cà rốt của bé');
  assert.equal(data.images[0].stage, 'seed');
  assert.equal(db.events.find(e => e[0] === 'list')[1].skip, 10);
  assert.deepEqual(db.events.find(e => e[0] === 'plants')[1].where.OR, [{ userId: 'owner', productId: 1 }]);
});
test('filters run before pagination and nickname searches preserve plant ownership', async () => {
  const db = database();
  assert.equal((await request(db, 'GET', '/user-images?search=carrot&status=hidden&media=video&stage=seed&sort=oldest')).statusCode, 200);
  const query = db.events.find(e => e[0] === 'list')[1];
  assert.equal(query.where.status, 'hidden');
  assert.equal(query.where.asset.mimeType.startsWith, 'video/');
  assert.equal(query.where.stage, 'seed');
  assert.ok(query.where.OR.some(item => item.userId === 'owner' && item.productId === 1));
  assert.deepEqual(query.orderBy[0], { createdAt: 'asc' });
});
test('invalid filters reject and out-of-range pages clamp', async () => {
  for (const query of ['status=wrong', 'page=-2', 'stage=not-a-stage', 'media=audio']) {
    assert.equal((await request(database(), 'GET', `/user-images?${query}`)).statusCode, 400);
  }
  const result = await request(database(), 'GET', '/user-images?page=100');
  assert.equal(result.json().page, 3);
});
test('deleted media cannot be restored or hidden by admin', async () => {
  for (const status of ['active', 'hidden']) {
    const db = database('deleted');
    const result = await request(db, 'PATCH', '/user-images/image/status', { status, reason: 'Không phù hợp' });
    assert.equal(result.statusCode, 409); assert.equal(db.events.length, 0);
  }
});
test('moderation requires a reason and records the prior status atomically', async () => {
  const db = database();
  assert.equal((await request(db, 'PATCH', '/user-images/image/status', { status: 'hidden' })).statusCode, 400);
  const result = await request(db, 'PATCH', '/user-images/image/status', { status: 'hidden', expectedStatus: 'active', reason: 'Nội dung không phù hợp' });
  assert.equal(result.statusCode, 200, result.body);
  assert.deepEqual(db.events.map(e => e[0]), ['update', 'audit']);
  assert.equal(db.events[0][1].where.status, 'active');
  assert.equal(db.events[1][1].data.metadata.reason, 'Nội dung không phù hợp');
});
test('concurrent user deletion or stale moderation returns conflict', async () => {
  const db = database();
  db.userProductImage.updateMany = async () => ({ count: 0 });
  assert.equal((await request(db, 'PATCH', '/user-images/image/status', { status: 'hidden', reason: 'Không phù hợp' })).statusCode, 409);
  assert.equal(db.events.length, 0);
  assert.equal((await request(database('hidden'), 'PATCH', '/user-images/image/status', { status: 'hidden', expectedStatus: 'active', reason: 'Không phù hợp' })).statusCode, 409);
});
test('legacy media has no invented plant or recorded growth stage', () => {
  const dto = imageJourney({ stage: null, product: { category: 'book', name: 'Book' } });
  assert.equal(dto.plant, null); assert.equal(dto.stageLabel, null); assert.equal(dto.species, null);
});
test('hidden media remains manageable but customer responses expose no file URL', () => {
  const dto = imageDto({ id: 'image', status: 'hidden', asset: { url: 'private-url' }, title: 'Ghi chú' });
  assert.equal(dto.url, null); assert.equal(dto.asset, null); assert.equal(dto.title, 'Ghi chú');
  assert.equal(imageDto({ status: 'active', asset: { url: 'private-url' } }).url, 'private-url');
});
test('direct local media access is denied after hiding or deletion', async () => {
  for (const status of ['hidden', 'deleted', 'active']) {
    const req = { user: { id: 'owner', role: 'customer' }, params: { '*': 'user_image/test.jpg' }, server: { prisma: {
      asset: { findFirst: async () => ({ ownerUserId: 'owner', userProductImages: [{ userId: 'owner', status }] }) },
    } } };
    if (status === 'active') await assetAccessGuard(req);
    else await assert.rejects(assetAccessGuard(req), { statusCode: 403 });
  }
});
