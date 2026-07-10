import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
});

export const prismaPlugin = fp(async (fastify) => {
  await prisma.$connect();
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
