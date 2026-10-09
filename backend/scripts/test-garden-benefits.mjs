// Run against a development PostgreSQL instance. All data lives in a temporary
// schema, never in the application's public schema.
import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { benefitsFor, reserveAi, saveGarden } from '../src/services/benefits.js';

const schema = `garden_test_${Date.now()}`;
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('schema', schema);
const admin = new PrismaClient();
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  await prisma.$executeRawUnsafe('CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "vipUntil" TIMESTAMP(3))');
  const migration = await readFile(new URL('../prisma/migrations/20261009100000_garden_benefits/migration.sql', import.meta.url), 'utf8');
  for (const statement of migration.split(';').filter(s => s.trim())) await prisma.$executeRawUnsafe(statement);
  await prisma.$executeRaw`INSERT INTO "User" ("id") VALUES ('test-customer')`;
  const concurrent = await Promise.allSettled(Array.from({ length: 12 }, () => reserveAi(prisma, 'test-customer')));
  assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 5);
  assert.equal((await benefitsFor(prisma, 'test-customer')).aiUsed, 5);
  await assert.rejects(saveGarden(prisma, 'test-customer', { scene: 'night', decoration: 'ceramic' }), e => e.statusCode === 403);
  const refund = concurrent.find(r => r.status === 'fulfilled').value;
  await refund(); await refund();
  assert.equal((await benefitsFor(prisma, 'test-customer')).aiUsed, 4);
  await prisma.$executeRaw`UPDATE "User" SET "vipUntil" = NOW() + INTERVAL '1 day' WHERE "id" = 'test-customer'`;
  const vip = await saveGarden(prisma, 'test-customer', { scene: 'night', decoration: 'ceramic' });
  assert.equal(vip.aiLimit, null); assert.equal(vip.maxLeaves, null); assert.equal(vip.scene, 'night');
  const vipConcurrent = await Promise.allSettled(Array.from({ length: 100 }, () => reserveAi(prisma, 'test-customer')));
  assert.equal(vipConcurrent.filter(r => r.status === 'fulfilled').length, 100);
  await prisma.$executeRaw`UPDATE "User" SET "vipUntil" = NOW() - INTERVAL '1 second' WHERE "id" = 'test-customer'`;
  const expired = await benefitsFor(prisma, 'test-customer');
  assert.equal(expired.scene, 'natural'); assert.equal(expired.maxLeaves, 10);
  await assert.rejects(reserveAi(prisma, 'test-customer'), e => e.statusCode === 429);
  console.log('PASS: migration, concurrent quotas, refunds, VIP upgrade, expiry and protected decorations');
} finally {
  await prisma.$disconnect();
  if (!/^garden_test_\d+$/.test(schema)) throw new Error('Invalid test schema');
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.$disconnect();
}
