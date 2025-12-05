export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireTournamentAccess } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    // 1. Authenticate
    const authResult = await requireAuth('tournament_admin');
    if (authResult instanceof NextResponse) return authResult;

    // Use singleton prisma instance
    const body = (await req.json()) as { teamId?: string; playerId?: string };
    if (!body?.teamId || !body?.playerId) return NextResponse.json({ error: 'teamId and playerId required' }, { status: 400 });

    const count = await prisma.teamPlayer.count({ where: { teamId: body.teamId } });
    if (count >= 8) return NextResponse.json({ error: 'team already has 8 players' }, { status: 400 });

    // Get the tournamentId from the team
    const team = await prisma.team.findUnique({ where: { id: body.teamId }, select: { tournamentId: true } });
    if (!team) return NextResponse.json({ error: 'team not found' }, { status: 404 });
    const tournamentId = team.tournamentId;
    if (!tournamentId) return NextResponse.json({ error: 'team has no tournament' }, { status: 400 });

    // 2. Authorize
    const accessCheck = await requireTournamentAccess(authResult, tournamentId);
    if (accessCheck instanceof NextResponse) return accessCheck;

    const link = await prisma.teamPlayer.create({
      data: {
        teamId: body.teamId,
        playerId: body.playerId,
        tournamentId: tournamentId
      }
    });
    return NextResponse.json(link, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
