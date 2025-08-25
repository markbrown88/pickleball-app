export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';

export async function GET() {
  const hasDb = !!process.env.DATABASE_URL;
  const hasDirect = !!process.env.DIRECT_URL;
  const node = process.versions.node;

  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`select 1`;
    return NextResponse.json({ ok: true, hasDb, hasDirect, node });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ ok: false, hasDb, hasDirect, node, error: message }, { status: 500 });
  }
}
