import { randomBytes, createHash } from 'crypto';
import path from 'path';
import { localStorageProvider } from './localStorage.js';
import { s3StorageProvider } from './s3Storage.js';
import { AppError } from '../../utils/errors.js';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export function storageProvider() {
  return (process.env.ASSET_STORAGE_PROVIDER || 'local') === 's3'
    ? s3StorageProvider()
    : localStorageProvider();
}

export function maxImageBytes() {
  return Number(process.env.MAX_IMAGE_UPLOAD_MB || 10) * 1024 * 1024;
}

export function maxVideoBytes() {
  return Number(process.env.MAX_VIDEO_UPLOAD_MB || 500) * 1024 * 1024;
}

// User-uploaded Cây Kỷ Niệm "leaf" videos are phone clips, not produced
// instructional content — cap them much smaller than admin instruction
// videos so the per-kit leaf cap actually bounds storage growth.
export function maxLeafVideoBytes() {
  return Number(process.env.MAX_LEAF_VIDEO_UPLOAD_MB || 50) * 1024 * 1024;
}

function extFor(filename, mimeType) {
  const ext = path.extname(filename || '').toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm', '.mov'].includes(ext)) return ext;
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  };
  return map[mimeType] || '';
}

/*
 * Finding F-06: the checks below trusted the multipart part's Content-Type, a
 * value the client writes. A file could claim `image/png`, pass validation and
 * be stored with a .png key while containing something else entirely.
 *
 * So read the actual leading bytes. These are fixed signatures at fixed
 * offsets — enough to confirm the container really is what the header claims,
 * without pulling in a media-parsing dependency.
 */
const MAGIC = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  // RIFF....WEBP
  'image/webp': (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  // ISO-BMFF: a size field, then the 'ftyp' box. Covers both .mp4 and .mov.
  'video/mp4': (b) => b.subarray(4, 8).toString('ascii') === 'ftyp',
  'video/quicktime': (b) => b.subarray(4, 8).toString('ascii') === 'ftyp',
  // WebM is Matroska: EBML header.
  'video/webm': (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
};

/** Throws unless the bytes match the declared type. */
export function assertMagicBytes(buffer, mimeType) {
  const check = MAGIC[mimeType];
  // An unknown type never reaches here — validateUpload rejects it first — but
  // fail closed rather than waving a file through on a missing entry.
  if (!check) throw new AppError('Định dạng tệp không được hỗ trợ.', 400);
  if (buffer.length < 16 || !check(buffer)) {
    throw new AppError('Nội dung tệp không khớp với định dạng đã khai báo.', 400);
  }
}

export function validateUpload({ mimeType, filename, bytes, category, maxBytesOverride }) {
  const isImage = category === 'image';
  const allowed = isImage ? IMAGE_MIME : VIDEO_MIME;
  const limit = maxBytesOverride ?? (isImage ? maxImageBytes() : maxVideoBytes());
  if (!allowed.has(mimeType)) {
    throw new AppError(isImage ? 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.' : 'Chỉ hỗ trợ video MP4, WEBM hoặc MOV.', 400);
  }
  if (bytes > limit) {
    throw new AppError(`Tệp vượt quá giới hạn ${Math.round(limit / 1024 / 1024)}MB.`, 413);
  }
  const ext = extFor(filename, mimeType);
  if (!ext) throw new AppError('Phần mở rộng tệp không hợp lệ.', 400);
  return ext;
}

export async function multipartFileToBuffer(file, { category, maxBytesOverride }) {
  if (!file) throw new AppError('Thiếu tệp upload.', 400);
  const chunks = [];
  let total = 0;
  const limit = maxBytesOverride ?? (category === 'image' ? maxImageBytes() : maxVideoBytes());
  for await (const chunk of file.file) {
    total += chunk.length;
    if (total > limit) throw new AppError(`Tệp vượt quá giới hạn ${Math.round(limit / 1024 / 1024)}MB.`, 413);
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const ext = validateUpload({
    mimeType: file.mimetype,
    filename: file.filename,
    bytes: buffer.length,
    category,
    maxBytesOverride,
  });
  // Only after validateUpload has confirmed the declared type is one we accept —
  // otherwise this would be looking up a signature for an arbitrary string.
  assertMagicBytes(buffer, file.mimetype);
  return { buffer, ext, mimeType: file.mimetype, originalName: file.filename, sizeBytes: buffer.length };
}

export function safeObjectKey({ kind, ownerUserId, productId, ext }) {
  const date = new Date().toISOString().slice(0, 10);
  const owner = ownerUserId ? `users/${ownerUserId}` : 'system';
  const product = productId ? `products/${productId}` : 'global';
  return `${kind}/${date}/${owner}/${product}/${randomBytes(16).toString('hex')}${ext}`;
}

export async function createAsset(prisma, {
  ownerUserId = null,
  productId = null,
  kind,
  file,
  category,
  metadata = null,
  maxBytesOverride,
}) {
  const parsed = await multipartFileToBuffer(file, { category, maxBytesOverride });
  const checksum = createHash('sha256').update(parsed.buffer).digest('hex');
  const key = safeObjectKey({ kind, ownerUserId, productId, ext: parsed.ext });
  const storage = storageProvider();
  const stored = await storage.putObject({
    buffer: parsed.buffer,
    key,
    mimeType: parsed.mimeType,
    metadata: metadata || {},
  });
  return prisma.asset.create({
    data: {
      ownerUserId,
      productId,
      kind,
      storageProvider: storage.provider,
      key: stored.key,
      url: stored.url,
      mimeType: parsed.mimeType,
      sizeBytes: parsed.sizeBytes,
      originalName: parsed.originalName,
      checksum,
      metadata,
    },
  });
}

export async function usableAssetUrl(asset) {
  if (!asset) return null;
  if (asset.storageProvider === 's3' && !process.env.S3_PUBLIC_BASE_URL) {
    return storageProvider().getSignedUrl({ key: asset.key, expiresIn: 900 });
  }
  return asset.url;
}
