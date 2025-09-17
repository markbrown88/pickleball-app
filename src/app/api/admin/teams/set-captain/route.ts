export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    // Use singleton prisma instance
    const body = await req.json() as { teamId?: string; playerId?: string };
    const { teamId, playerId } = body;
    if (!teamId || !playerId) return NextResponse.json({ error: 'teamId & playerId required' }, { status: 400 });

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return NextResponse.json({ error: 'team not found' }, { status: 404 });

    // player must be on the team
    const onTeam = await prisma.teamPlayer.findUnique({ where: { teamId_playerId: { teamId, playerId } } });
    if (!onTeam) return NextResponse.json({ error: 'player is not on this team' }, { status: 400 });

    // enforce unique: not captain of another team in the same tournament
    const conflict = await prisma.team.findFirst({
      where: { tournamentId: team.tournamentId, captainId: playerId, NOT: { id: teamId } },
      select: { id: true, name: true }
    });
    if (conflict) return NextResponse.json({ error: 'player already captains another team in this tournament' }, { status: 400 });

    const updated = await prisma.team.update({ where: { id: teamId }, data: { captainId: playerId } });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
