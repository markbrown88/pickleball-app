import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    await prisma.$executeRawUnsafe(`
      create table if not exists "Tournament" (
        id text primary key,
        name text not null,
        "createdAt" timestamptz not null default now()
      )
    `);
    return NextResponse.json({ dbOk: true });
  } catch (e: any) {
    console.error('DB CHECK ERROR:', e);
    return NextResponse.json({ dbOk: false, message: e?.message || 'error' }, { status: 500 });
  }
}
