import 'dotenv/config';
import path from 'path';
import { promises as fs } from 'fs';
import { PrismaClient } from '@prisma/client';
import { s3StorageProvider } from '../src/services/storage/s3Storage.js';
import { localUploadRoot } from '../src/services/storage/localStorage.js';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const rows = await prisma.asset.findMany({ where: { storageProvider: 'local' }, orderBy: { createdAt: 'asc' } });
  console.log(`${dryRun ? '[dry-run] ' : ''}Found ${rows.length} local assets.`);
  if (dryRun) {
    rows.forEach(a => console.log(`Would upload ${a.id}: ${a.key}`));
    return;
  }
  const s3 = s3StorageProvider();
  const root = localUploadRoot();
  let ok = 0;
  let failed = 0;
  for (const asset of rows) {
    try {
      const source = path.join(root, asset.key.replace(/^\/+/, ''));
      const rel = path.relative(root, source);
      if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Invalid local key');
      const buffer = await fs.readFile(source);
      const stored = await s3.putObject({
        buffer,
        key: asset.key,
        mimeType: asset.mimeType,
        metadata: { migratedFrom: 'local', assetId: asset.id },
      });
      await prisma.asset.update({
        where: { id: asset.id },
        data: { storageProvider: 's3', key: stored.key, url: stored.url },
      });
      ok += 1;
      console.log(`Uploaded ${asset.id}: ${asset.key}`);
    } catch (err) {
      failed += 1;
      console.error(`Failed ${asset.id}: ${err.message}`);
    }
  }
  console.log(`Done. Uploaded=${ok} Failed=${failed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
