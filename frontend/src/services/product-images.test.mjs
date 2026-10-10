import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductImageUrl, productGalleryImages, productImage } from './product-images.ts';
test('absolute uploaded URL is identical in card and detail gallery', () => {
  const product = { id: 11, images: ['https://cdn.example.com/uploads/product_image/photo.jpg?signature=abc'] };
  assert.equal(productImage(product), product.images[0]);
  assert.equal(productImage(product), productGalleryImages(product)[0]);
});
test('legacy upload paths are used rather than silently discarded', () => {
  assert.equal(productImage({ id: 11, images: ['/uploads/product-images/photo.jpg'] }), '/uploads/product-images/photo.jpg');
});
test('relative, root-relative and protocol-relative paths are normalized consistently', () => {
  assert.equal(resolveProductImageUrl('assets/images/products/kit-1.svg'), '/assets/images/products/kit-1.svg');
  assert.equal(resolveProductImageUrl(' /uploads/photo.png '), '/uploads/photo.png');
  assert.equal(resolveProductImageUrl('//cdn.example.com/image.jpg'), '//cdn.example.com/image.jpg');
  assert.equal(resolveProductImageUrl('./assets/image.png'), '/assets/image.png');
});
test('empty or invalid entries do not hide the first usable uploaded image', () => {
  const product = { id: 11, images: [null, '', 123, 'https://cdn.example.com/image.jpg'] };
  assert.equal(productImage(product), 'https://cdn.example.com/image.jpg');
  assert.deepEqual(productGalleryImages({ images: 'invalid' }), []);
  assert.equal(productImage({ id: 11, images: [] }), '/assets/images/products/kit-11.svg');
  assert.equal(resolveProductImageUrl('javascript:alert(1)'), null);
});
