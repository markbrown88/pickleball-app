import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    const data = await prisma.tournament.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'error';
    console.error('GET /api/tournaments', message);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string };
    const name = (body?.name ?? '').toString().trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const created = await prisma.tournament.create({ data: { name } });
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'error';
    console.error('POST /api/tournaments', message);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
