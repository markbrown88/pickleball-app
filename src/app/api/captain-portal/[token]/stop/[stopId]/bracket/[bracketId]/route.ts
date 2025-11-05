import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string; stopId: string; bracketId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { token, stopId, bracketId } = await params;

    // Validate token
    const tournamentClub = await prisma.tournamentClub.findUnique({
      where: { captainAccessToken: token },
      select: {
        tournamentId: true,
        clubId: true
      }
    });

    if (!tournamentClub) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    // Get this club's team in this bracket
    const team = await prisma.team.findFirst({
      where: {
        tournamentId: tournamentClub.tournamentId,
        clubId: tournamentClub.clubId,
        bracketId: bracketId
      },
      select: { id: true, name: true }
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get all rounds for this stop
    const rounds = await prisma.round.findMany({
      where: { stopId },
      orderBy: { idx: 'asc' },
      include: {
        matches: {
          where: {
            OR: [
              { teamAId: team.id },
              { teamBId: team.id }
            ]
          },
          include: {
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
            games: {
              select: {
                id: true
              }
            }
          }
        }
      }
    });

    // Map rounds to include opponent info and lineup completion
    const roundsData = rounds.map(round => {
      const match = round.matches[0]; // Should only be one match per team per round
      if (!match) return null;

      const opponentTeam = match.teamAId === team.id ? match.teamB : match.teamA;

      // Note: Lineup completion checking removed as lineups are now in Lineup/LineupEntry tables
      const lineupsComplete = false; // TODO: Implement lineup checking with new schema

      return {
        id: round.id,
        idx: round.idx,
        matchId: match.id,
        opponentTeamName: opponentTeam?.name || 'TBD',
        lineupsComplete
      };
    }).filter(Boolean);

    return NextResponse.json({
      rounds: roundsData
    });
  } catch (error) {
    console.error('Bracket rounds error:', error);
    return NextResponse.json(
      { error: 'Failed to load rounds' },
      { status: 500 }
    );
  }
}
