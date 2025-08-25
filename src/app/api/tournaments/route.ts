// Force Node runtime (Prisma doesn't run on Edge)
export const runtime = 'nodejs';
// Avoid any pre-rendering shenanigans
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';

export async function GET() {
  try {
    const prisma = getPrisma();
    const data = await prisma.tournament.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'error';
    console.error('GET /api/tournaments', message);
    return NextResponse.json({ error: message }, { status: 500 }); // <-- JSON
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = (await req.json()) as { name?: string };
    const name = (body?.name ?? '').toString().trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const created = await prisma.tournament.create({ data: { name } });
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'error';
    console.error('POST /api/tournaments', message);
    return NextResponse.json({ error: message }, { status: 500 }); // <-- JSON
  }
}
