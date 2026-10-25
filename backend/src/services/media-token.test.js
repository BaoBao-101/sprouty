import test from 'node:test';
import assert from 'node:assert/strict';
import { signMediaToken, verifyMediaToken } from './media-token.js';
import { assetAccessGuard } from '../middleware/assetGuard.js';

const USER = 'ckuser000000001';

test('a media token names its user until it expires', () => {
  const now = Date.UTC(2026, 9, 22);
  const { token, expiresAt } = signMediaToken(USER, { now, ttlSeconds: 60 });
  assert.equal(verifyMediaToken(token, { now }), USER);
  assert.equal(expiresAt.getTime(), now + 60_000);
  assert.equal(verifyMediaToken(token, { now: now + 61_000 }), null);
});

test('a tampered media token is refused', () => {
  const { token } = signMediaToken(USER);
  const [id, exp, sig] = token.split('.');
  for (const bad of [
    `ckother00000001.${exp}.${sig}`,
    `${id}.${Number(exp) + 9999}.${sig}`,
    `${id}.${exp}.${sig.slice(0, -1)}A`,
    `${id}.${exp}`,
    '',
    null,
    'x'.repeat(500),
  ]) {
    assert.equal(verifyMediaToken(bad), null, String(bad));
  }
});

test('the app can open its own album photo with a media token, and only that', async () => {
  const owner = { id: USER, role: 'customer', status: 'active' };
  const req = (mt, who = owner) => ({
    params: { '*': 'user_image/abc.jpg' },
    query: mt ? { mt } : {},
    user: null,
    server: { prisma: {
      user: { findUnique: async () => who },
      asset: { findFirst: async () => ({ ownerUserId: USER, userProductImages: [{ userId: USER, status: 'active' }] }) },
    } },
  });

  await assetAccessGuard(req(signMediaToken(USER).token));
  await assert.rejects(assetAccessGuard(req(null)), { statusCode: 401 });
  await assert.rejects(assetAccessGuard(req('forged.123.abc')), { statusCode: 401 });
  // A disabled account's tokens stop working with it.
  await assert.rejects(assetAccessGuard(req(signMediaToken(USER).token, { ...owner, status: 'disabled' })), { statusCode: 401 });
  // Somebody else's token still has to pass the owner rule.
  const other = { id: 'ckother00000001', role: 'customer', status: 'active' };
  await assert.rejects(assetAccessGuard(req(signMediaToken(other.id).token, other)), { statusCode: 403 });
});
