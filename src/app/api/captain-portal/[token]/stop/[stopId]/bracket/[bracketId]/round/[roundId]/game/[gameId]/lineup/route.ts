import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{
    token: string;
    stopId: string;
    bracketId: string;
    roundId: string;
    gameId: string;
  }>;
};

export async function PUT(request: Request, { params }: Params) {
  try {
    const { token, stopId, gameId } = await params;
    const { lineup } = await request.json();

    // Validate token
    const tournamentClub = await prisma.tournamentClub.findUnique({
      where: { captainAccessToken: token },
      select: { tournamentId: true, clubId: true }
    });

    if (!tournamentClub) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    // Get the game and check deadline
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            round: {
              include: {
                stop: {
                  select: { lineupDeadline: true }
                }
              }
            },
            teamA: { select: { id: true, clubId: true } },
            teamB: { select: { id: true, clubId: true } }
          }
        }
      }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Check if deadline has passed
    const deadline = game.match.round.stop.lineupDeadline;
    if (deadline && new Date() > new Date(deadline)) {
      return NextResponse.json({ error: 'Lineup deadline has passed' }, { status: 403 });
    }

    // Determine if this club is Team A or Team B
    const isTeamA = game.match.teamA?.clubId === tournamentClub.clubId;
    const isTeamB = game.match.teamB?.clubId === tournamentClub.clubId;

    if (!isTeamA && !isTeamB) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validate lineup: should be array of 2 player IDs
    if (!Array.isArray(lineup) || lineup.length !== 2) {
      return NextResponse.json({ error: 'Invalid lineup format' }, { status: 400 });
    }

    // Build lineup structure: [{player1Id, player2Id}]
    const lineupData = [{
      player1Id: lineup[0],
      player2Id: lineup[1]
    }];

    // Update the appropriate lineup field
    const updateData = isTeamA
      ? { teamALineup: lineupData }
      : { teamBLineup: lineupData };

    await prisma.game.update({
      where: { id: gameId },
      data: updateData
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save lineup:', error);
    return NextResponse.json(
      { error: 'Failed to save lineup' },
      { status: 500 }
    );
  }
}
