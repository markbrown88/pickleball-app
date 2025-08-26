export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function GET() {
  try {
    const prisma = getPrisma();
    const rows = await prisma.player.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = (await req.json()) as { name?: string; gender?: 'MALE'|'FEMALE' };
    if (!body?.name || !body?.gender) return NextResponse.json({ error: 'name and gender required' }, { status: 400 });
    const p = await prisma.player.create({ data: { name: body.name.trim(), gender: body.gender } });
    return NextResponse.json(p, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
