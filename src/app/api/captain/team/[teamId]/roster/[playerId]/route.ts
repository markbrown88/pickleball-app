import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';

export async function DELETE(_req: Request, { params }: { params: { teamId: string, playerId: string }}) {
  await prisma.teamPlayer.delete({ where: { teamId_playerId: { teamId: params.teamId, playerId: params.playerId } }});
  return NextResponse.json({ ok: true });
}
