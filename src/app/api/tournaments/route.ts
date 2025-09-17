// src/app/api/admin/tournaments/route.ts

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  // Use singleton prisma instance
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, createdAt: true, type: true },
    });
    return NextResponse.json(tournaments);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Use singleton prisma instance
    const body = (await req.json()) as { name?: string };
    const name = (body?.name ?? '').toString().trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const created = await prisma.tournament.create({ data: { name } });
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'error';
    console.error('POST /api/tournaments', message);
    return NextResponse.json({ error: message }, { status: 500 });  // JSON error
  }
}
