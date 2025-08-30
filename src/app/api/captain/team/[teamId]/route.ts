import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { teamId: string }}) {
  const { name, clubId } = await req.json();
  await prisma.team.update({
    where: { id: params.teamId },
    data: { name, clubId },
  });
  return NextResponse.json({ ok: true });
}
