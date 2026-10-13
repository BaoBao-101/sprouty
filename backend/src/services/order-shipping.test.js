import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_RECEIVE_DAYS, resetSettleClock, settleArrived } from './order-shipping.js';

function fakePrisma() {
  const calls = [];
  return {
    calls,
    order: { async updateMany(args) { calls.push(args); return { count: 2 }; } },
  };
}

test('parcels sent over a week ago and never confirmed are completed as "auto"', async () => {
  resetSettleClock();
  const prisma = fakePrisma();
  const now = new Date('2026-10-20T10:00:00Z');
  assert.equal(await settleArrived(prisma, now), 2);
  const { where, data } = prisma.calls[0];
  assert.equal(where.status, 'shipped');
  const cutoff = new Date(now.getTime() - AUTO_RECEIVE_DAYS * 86_400_000);
  assert.deepEqual(where.OR[0], { shippedAt: { lt: cutoff } });
  // Shipped before the column existed: judged by when the status last changed.
  assert.deepEqual(where.OR[1], { shippedAt: null, updatedAt: { lt: cutoff } });
  assert.deepEqual(data, { status: 'delivered', deliveredAt: now, deliveredBy: 'auto' });
});

test('runs at most once a minute, however many pages ask', async () => {
  resetSettleClock();
  const prisma = fakePrisma();
  const now = new Date('2026-10-20T10:00:00Z');
  await settleArrived(prisma, now);
  await settleArrived(prisma, new Date(now.getTime() + 30_000));
  assert.equal(prisma.calls.length, 1);
  await settleArrived(prisma, new Date(now.getTime() + 61_000));
  assert.equal(prisma.calls.length, 2);
});
