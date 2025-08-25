import { PrismaClient } from '@prisma/client';

/** Lazy singleton so PrismaClient isn't constructed during module import (prevents Vercel build issues). */
let prismaGlobal: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (prismaGlobal) return prismaGlobal;
  const client = new PrismaClient({ log: ['warn', 'error'] });
  // cache only in dev to avoid leaking across serverless invocations
  if (process.env.NODE_ENV !== 'production') prismaGlobal = client;
  return client;
}
