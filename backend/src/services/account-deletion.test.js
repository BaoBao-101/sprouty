import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { deleteCustomerAccount, deletedEmail, DELETED_NAME } from './account-deletion.js';

const HASH = bcrypt.hashSync('123456', 4);

function database({ role = 'customer', inFlight = 0, paidSeats = 0 } = {}) {
  const events = [];
  const record = (model, op) => async (args) => { events.push([model, op, args]); return { count: 0 }; };
  const model = (name) => ({
    deleteMany: record(name, 'deleteMany'),
    updateMany: record(name, 'updateMany'),
  });
  const db = {
    events,
    user: {
      async findUnique() { return { id: 'u1', role, status: 'active', passwordHash: HASH }; },
      update: record('user', 'update'),
    },
    order: { ...model('order'), async count() { return inFlight; } },
    workshopRegistration: { ...model('workshopRegistration'), async count() { return paidSeats; } },
    asset: { ...model('asset'), async findMany() { return []; } },
    productReview: { ...model('productReview'), async findMany() { return []; } },
    workshopReview: model('workshopReview'),
    userProductImage: model('userProductImage'),
    virtualPlant: model('virtualPlant'),
    userVideoProgress: model('userVideoProgress'),
    userEntitlement: model('userEntitlement'),
    reward: model('reward'),
    aiDailyUsage: model('aiDailyUsage'),
    gardenPreference: model('gardenPreference'),
    session: model('session'),
    auditLog: { create: record('auditLog', 'create') },
    async $transaction(fn) { return fn(db); },
  };
  return db;
}

test('a wrong password deletes nothing', async () => {
  const db = database();
  await assert.rejects(deleteCustomerAccount(db, { userId: 'u1', password: 'nope' }), { statusCode: 400 });
  assert.deepEqual(db.events, []);
});

test('staff cannot delete themselves from the app', async () => {
  const db = database({ role: 'admin' });
  await assert.rejects(deleteCustomerAccount(db, { userId: 'u1', password: '123456' }), { statusCode: 403 });
  assert.deepEqual(db.events, []);
});

test('a parcel on its way or a paid seat to come blocks deletion', async () => {
  for (const blocked of [{ inFlight: 1 }, { paidSeats: 1 }]) {
    const db = database(blocked);
    await assert.rejects(deleteCustomerAccount(db, { userId: 'u1', password: '123456' }), { statusCode: 409 });
    assert.deepEqual(db.events, []);
  }
});

test('deleting removes the family data and anonymises the books', async () => {
  const db = database();
  await deleteCustomerAccount(db, { userId: 'u1', password: '123456' });
  const did = (model, op) => db.events.filter((e) => e[0] === model && e[1] === op);

  for (const name of ['session', 'productReview', 'workshopReview', 'userProductImage', 'virtualPlant', 'userEntitlement', 'reward']) {
    assert.equal(did(name, 'deleteMany').length, 1, name);
  }
  const husk = did('user', 'update')[0][2].data;
  assert.equal(husk.email, deletedEmail('u1'));
  assert.equal(husk.name, DELETED_NAME);
  assert.equal(husk.status, 'disabled');
  assert.equal(await bcrypt.compare('123456', husk.passwordHash), false);

  const scrubbed = did('order', 'updateMany').find((e) => 'shippingPhone' in e[2].data);
  assert.deepEqual(scrubbed[2].data, { shippingName: DELETED_NAME, shippingPhone: '', shippingAddress: '', note: null });
  assert.equal(did('auditLog', 'create')[0][2].data.action, 'user.account.delete');
});
