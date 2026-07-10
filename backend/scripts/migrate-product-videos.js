import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const creatorEmail = process.env.LEGACY_VIDEO_CREATOR_EMAIL;

function normalizeVideos(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((v, i) => {
    if (typeof v === 'string') return { title: `Video ${i + 1}`, externalUrl: v, sortOrder: i };
    return {
      title: v.title || v.name || `Video ${i + 1}`,
      description: v.description || null,
      durationSec: Number.isInteger(v.durationSec) ? v.durationSec : null,
      externalUrl: v.url || v.externalUrl || null,
      sortOrder: Number.isInteger(v.sortOrder) ? v.sortOrder : i,
      status: v.status === 'draft' || v.status === 'archived' ? v.status : 'published',
    };
  }).filter(v => v.externalUrl);
}

async function main() {
  const creator = creatorEmail
    ? await prisma.user.findUnique({ where: { email: creatorEmail } })
    : await prisma.user.findFirst({ where: { role: { in: ['admin', 'employee'] } }, orderBy: { createdAt: 'asc' } });
  if (!creator) throw new Error('No admin/employee user found. Set LEGACY_VIDEO_CREATOR_EMAIL.');
  const products = await prisma.product.findMany({ select: { id: true, videos: true } });
  let count = 0;
  for (const product of products) {
    const videos = normalizeVideos(product.videos);
    for (const video of videos) {
      const existing = await prisma.instructionVideo.findFirst({
        where: { productId: product.id, externalUrl: video.externalUrl },
      });
      if (existing) continue;
      count += 1;
      if (dryRun) {
        console.log(`[dry-run] Product ${product.id}: ${video.title} -> ${video.externalUrl}`);
      } else {
        await prisma.instructionVideo.create({
          data: { ...video, productId: product.id, createdByUserId: creator.id },
        });
      }
    }
  }
  console.log(`${dryRun ? 'Would migrate' : 'Migrated'} ${count} videos.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
