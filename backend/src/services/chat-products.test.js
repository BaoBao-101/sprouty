import test from 'node:test';
import assert from 'node:assert/strict';
import { chatProducts } from './chat-products.js';

const catalogue = [{ id: 31, name: 'Kit thật', price: 150000, ageRange: '4–10 tuổi', images: ['/uploads/kit.png'] }];
test('cards use catalogue values and deduplicate model references', () => {
  const result = chatProducts('Kit thật [[kit:31]] và [[kit:31]]', catalogue);
  assert.equal(result.products.length, 1);
  assert.deepEqual(result.products[0], { id: 31, name: 'Kit thật', price: 150000, ageRange: '4–10 tuổi', image: '/uploads/kit.png' });
  assert.ok(!result.reply.includes('[[kit:'));
});
test('unknown IDs cannot create product links', () => {
  assert.deepEqual(chatProducts('Kit [[kit:999]]', catalogue).products, []);
  assert.deepEqual(chatProducts('Chăm cây mỗi ngày', catalogue).products, []);
  assert.deepEqual(chatProducts('[[kit:31]]', []).products, []);
});
