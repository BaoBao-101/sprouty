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

export function validateUpload({ mimeType, filename, bytes, category }) {
  const isImage = category === 'image';
  const allowed = isImage ? IMAGE_MIME : VIDEO_MIME;
  const limit = isImage ? maxImageBytes() : maxVideoBytes();
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

export async function multipartFileToBuffer(file, { category }) {
  if (!file) throw new AppError('Thiếu tệp upload.', 400);
  const chunks = [];
  let total = 0;
  const limit = category === 'image' ? maxImageBytes() : maxVideoBytes();
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
  });
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
}) {
  const parsed = await multipartFileToBuffer(file, { category });
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
