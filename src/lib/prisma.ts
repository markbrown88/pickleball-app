import { PrismaClient } from '@prisma/client';

/** Lazy singleton so PrismaClient isn't constructed during import (prevents build issues). */
let prismaGlobal: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (prismaGlobal) return prismaGlobal;
  const client = new PrismaClient({ log: ['warn', 'error'] });
  if (process.env.NODE_ENV !== 'production') prismaGlobal = client; // cache only in dev
  return client;
}
