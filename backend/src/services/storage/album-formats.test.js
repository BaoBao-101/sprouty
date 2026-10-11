import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { albumFormat } from './album-formats.js';
import { multipartFileToBuffer } from './index.js';

function upload(filename, mimetype, bytes) {
  return { filename, mimetype, file: Readable.from([bytes]) };
}

test('album accepts MKV even when the browser reports a generic MIME', async () => {
  const bytes = Buffer.alloc(32);
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3]).copy(bytes);
  const parsed = await multipartFileToBuffer(upload('clip.MKV', 'application/octet-stream', bytes), { category: 'video', albumMedia: true });
  assert.equal(parsed.mimeType, 'video/x-matroska');
  assert.equal(parsed.ext, '.mkv');
});

test('album supports HEIC, GIF and AVI container signatures', async () => {
  for (const [filename, header, offset, mimeType] of [
    ['photo.heic', 'ftypheic', 4, 'image/heic'],
    ['animation.gif', 'GIF89a', 0, 'image/gif'],
    ['clip.avi', 'RIFF0000AVI ', 0, 'video/x-msvideo'],
  ]) {
    const bytes = Buffer.alloc(32);
    bytes.write(header, offset);
    const parsed = await multipartFileToBuffer(upload(filename, '', bytes), { category: mimeType.startsWith('image') ? 'image' : 'video', albumMedia: true });
    assert.equal(parsed.mimeType, mimeType);
  }
});

test('unrecognized contents are stored as binary, while size and truncation remain enforced', async () => {
  const unknown = await multipartFileToBuffer(upload('camera.raw', '', Buffer.alloc(32)), { category: 'image', albumMedia: true });
  assert.equal(unknown.mimeType, 'application/octet-stream');
  assert.equal(unknown.ext, '.bin');
  assert.equal(unknown.originalName, 'camera.raw');
  const disguised = await multipartFileToBuffer(upload('fake.gif', 'image/gif', Buffer.from('<html>not an image</html>')), { category: 'image', albumMedia: true });
  assert.equal(disguised.mimeType, 'application/octet-stream');
  await assert.rejects(multipartFileToBuffer(upload('big.mkv', 'video/x-matroska', Buffer.alloc(32)), { category: 'video', albumMedia: true, maxBytesOverride: 16 }));
  const file = upload('cut.gif', 'image/gif', Buffer.from('GIF89a00000000000000'));
  file.file.truncated = true;
  await assert.rejects(multipartFileToBuffer(file, { category: 'image', albumMedia: true }));
  assert.equal(albumFormat('script.html', 'text/html'), undefined);
});

test('other media upload routes also accept extended formats', async () => {
  const parsed = await multipartFileToBuffer(upload('photo.gif', 'image/gif', Buffer.from('GIF89a00000000000000')), { category: 'image' });
  assert.equal(parsed.mimeType, 'image/gif');
  await assert.rejects(multipartFileToBuffer(upload('page.html', 'text/html', Buffer.from('<html>test</html>')), { category: 'image' }));
  await assert.rejects(multipartFileToBuffer(upload('empty.raw', '', Buffer.alloc(0)), { category: 'image', albumMedia: true }));
});
