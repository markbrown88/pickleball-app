import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapLineupToEntries } from '@/lib/lineupSlots';
import type { GameSlot } from '@prisma/client';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/captain-portal/[token]/match/lineup
 *
 * Saves lineups for all brackets in a DE Clubs match.
 * Lineups can only be saved before any game in the match has started.
 *
 * Request body:
 * {
 *   matchId: string,
 *   lineups: Array<{
 *     bracketId: string,
 *     lineup: [Player, Player, Player, Player] // 2 men, 2 women
 *   }>
 * }
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;

    // Verify captain token
    const tournamentClub = await prisma.tournamentClub.findUnique({
      where: { captainAccessToken: token },
      include: {
        tournament: {
          select: {
            id: true,
            type: true
          }
        },
        club: {
          select: {
            id: true
          }
        }
      }
    });

    if (!tournamentClub) {
      return NextResponse.json(
        { error: 'Invalid access token' },
        { status: 404 }
      );
    }

    // Only for DE Clubs tournaments
    if (tournamentClub.tournament.type !== 'DOUBLE_ELIMINATION_CLUBS') {
      return NextResponse.json(
        { error: 'This endpoint is only for Double Elimination Clubs tournaments' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { matchId, lineups } = body;

    if (!matchId || !Array.isArray(lineups)) {
      return NextResponse.json(
        { error: 'matchId and lineups array are required' },
        { status: 400 }
      );
    }

    // Get the match and verify it hasn't started
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        games: {
          select: {
            startedAt: true
          }
        },
        round: {
          include: {
            stop: {
              select: {
                id: true
              }
            }
          }
        },
        teamA: {
          select: {
            id: true,
            clubId: true,
            bracketId: true
          }
        },
        teamB: {
          select: {
            id: true,
            clubId: true,
            bracketId: true
          }
        }
      }
    });

    if (!match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    // Verify this club owns one of the teams in the match
    const isTeamA = match.teamA?.clubId === tournamentClub.clubId;
    const isTeamB = match.teamB?.clubId === tournamentClub.clubId;

    if (!isTeamA && !isTeamB) {
      return NextResponse.json(
        { error: 'Unauthorized: This match does not belong to your club' },
        { status: 403 }
      );
    }

    // Check if any game has started
    if (match.games.some(g => g.startedAt !== null)) {
      return NextResponse.json(
        { error: 'Cannot edit lineups after match has started' },
        { status: 400 }
      );
    }

    // Get all teams for this club
    const clubTeams = await prisma.team.findMany({
      where: {
        tournamentId: tournamentClub.tournamentId,
        clubId: tournamentClub.clubId
      },
      select: {
        id: true,
        bracketId: true
      }
    });

    // Save all lineups in a transaction
    await prisma.$transaction(async (tx) => {
      for (const lineupData of lineups) {
        const { bracketId, lineup } = lineupData;

        if (!bracketId || !Array.isArray(lineup) || lineup.length !== 4) {
          console.warn(`Skipping invalid lineup for bracket ${bracketId}`);
          continue;
        }

        // Find the team for this bracket
        const team = clubTeams.find(t => t.bracketId === bracketId);
        if (!team) {
          console.warn(`Team not found for bracket ${bracketId}`);
          continue;
        }

        // Validate lineup has 2 men and 2 women
        const men = lineup.filter(p => p.gender === 'MALE');
        const women = lineup.filter(p => p.gender === 'FEMALE');

        if (men.length !== 2 || women.length !== 2) {
          throw new Error(`Invalid lineup for bracket ${bracketId}: Must have exactly 2 men and 2 women`);
        }

        // Delete existing lineup for this team/round/bracket
        await tx.lineup.deleteMany({
          where: {
            roundId: match.roundId,
            teamId: team.id,
            bracketId: bracketId
          }
        });

        // Create new lineup
        const newLineup = await tx.lineup.create({
          data: {
            roundId: match.roundId,
            teamId: team.id,
            bracketId: bracketId,
            stopId: match.round.stop.id
          }
        });

        // Map lineup to entries (MENS_DOUBLES, WOMENS_DOUBLES, MIXED_1, MIXED_2)
        const entries = mapLineupToEntries(lineup);

        // Create lineup entries
        await tx.lineupEntry.createMany({
          data: entries.map((entry) => ({
            lineupId: newLineup.id,
            slot: entry.slot as GameSlot,
            player1Id: entry.player1Id!,
            player2Id: entry.player2Id!,
          })),
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Captain portal lineup save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save lineups' },
      { status: 500 }
    );
  }
}
