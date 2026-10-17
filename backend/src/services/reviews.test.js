import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanTags,
  ratingSummary,
  recomputeProductRating,
  reviewableWorkshops,
  reviewerName,
  REVIEW_TAGS,
  WORKSHOP_REVIEW_TAGS,
  workshopRatingSummary,
} from './reviews.js';

test('a reviewer is named by given name and family initial, or not at all', () => {
  assert.equal(reviewerName('Nguyễn Mai Anh', false), 'Mai Anh N.');
  assert.equal(reviewerName('  Trần   Quốc Bảo ', false), 'Quốc Bảo T.');
  assert.equal(reviewerName('Bảo', false), 'Bảo');
  assert.equal(reviewerName('Nguyễn Mai Anh', true), 'Khách hàng Sprouty');
  assert.equal(reviewerName('', false), 'Khách hàng Sprouty');
});

test('only the offered remarks are kept, once each', () => {
  const [good] = REVIEW_TAGS.good;
  const [bad] = REVIEW_TAGS.bad;
  assert.deepEqual(cleanTags([good, 'Spam ở đây', good, ` ${bad} `]), [good, bad]);
  assert.deepEqual(cleanTags(undefined), []);
});

test('the score panel counts each star and the share that recommends', async () => {
  const prisma = {
    productReview: {
      groupBy: async () => [{ rating: 5, _count: { _all: 6 } }, { rating: 4, _count: { _all: 2 } }, { rating: 1, _count: { _all: 2 } }],
      count: async () => 3,
    },
  };
  const s = await ratingSummary(prisma, 1);
  assert.equal(s.count, 10);
  assert.equal(s.average, 4);
  assert.deepEqual(s.distribution, { 1: 2, 2: 0, 3: 0, 4: 2, 5: 6 });
  assert.equal(s.recommendPercent, 80);
  assert.equal(s.withPhotos, 3);
});

test('a product with no published reviews scores zero, not NaN', async () => {
  let saved;
  const prisma = {
    productReview: { aggregate: async () => ({ _avg: { rating: null }, _count: { _all: 0 } }) },
    product: { update: async ({ data }) => { saved = data; } },
  };
  assert.deepEqual(await recomputeProductRating(prisma, 1), { ratingAvg: 0, ratingCount: 0 });
  assert.deepEqual(saved, { ratingAvg: 0, ratingCount: 0 });
});

test('a workshop review keeps only workshop remarks', () => {
  const [session] = WORKSHOP_REVIEW_TAGS.good;
  const [kit] = REVIEW_TAGS.good;
  assert.deepEqual(cleanTags([session, kit], 'workshop'), [session]);
  assert.deepEqual(cleanTags([session, kit]), [kit]);
});

test('the workshop score reads published reviews, of one session or all', async () => {
  const seen = [];
  const prisma = {
    workshopReview: {
      groupBy: async ({ where }) => { seen.push(where); return [{ rating: 5, _count: { _all: 3 } }, { rating: 3, _count: { _all: 1 } }]; },
      count: async () => 1,
    },
  };
  const all = await workshopRatingSummary(prisma);
  assert.equal(all.count, 4);
  assert.equal(all.average, 4.5);
  assert.equal(all.recommendPercent, 75);
  await workshopRatingSummary(prisma, 'w1');
  assert.deepEqual(seen, [{ status: 'published' }, { workshopId: 'w1', status: 'published' }]);
});

test('only checked-in bookings make a session reviewable, once per session', async () => {
  let asked;
  const w = (id) => ({ id, title: id, imageUrl: null, dateTime: new Date(), endTime: null, location: 'HCM' });
  const prisma = {
    workshopRegistration: {
      findMany: async (args) => {
        asked = args.where;
        return [
          { id: 'r2', checkedInAt: new Date(), workshop: w('w1') },
          { id: 'r1', checkedInAt: new Date(), workshop: w('w1') },
          { id: 'r3', checkedInAt: new Date(), workshop: w('w2') },
        ];
      },
    },
  };
  const eligible = await reviewableWorkshops(prisma, 'u1');
  assert.deepEqual([...eligible.keys()], ['w1', 'w2']);
  assert.equal(eligible.get('w1').registrationId, 'r2');
  assert.deepEqual(asked.checkedInAt, { not: null });
  assert.deepEqual(asked.status, { not: 'cancelled' });
  assert.deepEqual(asked.workshop, { status: { not: 'cancelled' } });
});
