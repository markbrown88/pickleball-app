// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

type GlobalWithPrisma = typeof globalThis & { __prisma?: PrismaClient };

// Ensure a single PrismaClient across hot-reloads in dev
const g = globalThis as GlobalWithPrisma;

export const prisma: PrismaClient =
  g.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  g.__prisma = prisma;
}

// Small helper so existing code can keep calling getPrisma()
export function getPrisma() {
  return prisma;
}
