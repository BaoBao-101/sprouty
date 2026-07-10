import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function clientConfig() {
  const cfg = {
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  };
  if (process.env.S3_ENDPOINT) cfg.endpoint = process.env.S3_ENDPOINT;
  if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    cfg.credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    };
  }
  return cfg;
}

export function s3StorageProvider() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET is required when ASSET_STORAGE_PROVIDER=s3');
  const client = new S3Client(clientConfig());
  const publicBase = process.env.S3_PUBLIC_BASE_URL || '';

  return {
    provider: 's3',

    async putObject({ buffer, key, mimeType, metadata }) {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: metadata || {},
      }));
      return { key, url: this.getPublicUrl({ key }) };
    },

    async deleteObject({ key }) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    getPublicUrl({ key }) {
      if (publicBase) return `${publicBase.replace(/\/$/, '')}/${key}`;
      return `https://${bucket}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    },

    async getSignedUrl({ key, expiresIn = 900 }) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
    },
  };
}
