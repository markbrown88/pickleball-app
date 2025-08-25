import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    // connectivity
    await prisma.$queryRaw`select 1`;

    // ensure table exists (safe no-op if already created)
    await prisma.$executeRawUnsafe(`
      create table if not exists "Tournament" (
        id text primary key,
        name text not null,
        "createdAt" timestamptz not null default now()
      )
    `);

    return NextResponse.json({ dbOk: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'error';
    console.error('DB CHECK ERROR:', message);
    return NextResponse.json({ dbOk: false, message }, { status: 500 });
  }
}
