// Public Bracket API - Returns bracket structure for double elimination tournaments
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCached, cacheKeys, CACHE_TTL } from '@/lib/cache';
import { evaluateMatchTiebreaker } from '@/lib/matchTiebreaker';

type Ctx = { params: Promise<{ stopId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { stopId } = await ctx.params;

    // Cache bracket data (30 second TTL for real-time updates during tournaments)
    const payload = await getCached(
      cacheKeys.stopSchedule(stopId),
      async () => {
        // Validate stop
        const stop = await prisma.stop.findUnique({
          where: { id: stopId },
          select: { id: true, tournamentId: true, tournament: { select: { type: true } } },
        });

        if (!stop) {
          throw new Error('Stop not found');
        }

        // Check if this is a double elimination tournament
        const isDoubleElimination = stop.tournament?.type === 'DOUBLE_ELIMINATION' || stop.tournament?.type === 'DOUBLE_ELIMINATION_CLUBS';

        // Fetch all rounds with matches and games
        const rounds = await prisma.round.findMany({
          where: { stopId },
          orderBy: { idx: 'asc' },
          include: {
            matches: {
              orderBy: { id: 'asc' },
              include: {
                teamA: {
                  select: {
                    id: true,
                    name: true,
                    club: { select: { name: true } }
                  }
                },
                teamB: {
                  select: {
                    id: true,
                    name: true,
                    club: { select: { name: true } }
                  }
                },
                games: {
                  orderBy: { slot: 'asc' },
                  select: {
                    id: true,
                    slot: true,
                    teamAScore: true,
                    teamBScore: true,
                    isComplete: true,
                    startedAt: true,
                    endedAt: true,
                    teamALineup: isDoubleElimination ? {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        name: true
                      }
                    } : false,
                    teamBLineup: isDoubleElimination ? {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        name: true
                      }
                    } : false,
                  }
                }
              }
            }
          }
        });

        // Transform rounds to include winnerId based on game results
        const transformedRounds = rounds.map(round => ({
          id: round.id,
          idx: round.idx,
          bracketType: round.bracketType,
          depth: round.depth,
          matches: round.matches.map(match => {
            // Calculate winner based on games
            let winnerId: string | null = null;

            if (match.forfeitTeam) {
              winnerId = match.forfeitTeam === 'A' ? match.teamBId : match.teamAId;
            } else {
              // Check tiebreaker
              const tiebreakerResult = evaluateMatchTiebreaker(
                match.games,
                match.tiebreakerStatus,
                match.tiebreakerWinnerTeamId,
                match.totalPointsTeamA,
                match.totalPointsTeamB
              );

              if (tiebreakerResult.winnerId) {
                winnerId = tiebreakerResult.winnerId;
              } else {
                // Count game wins
                let teamAWins = 0;
                let teamBWins = 0;

                match.games.forEach(game => {
                  if (game.isComplete && game.teamAScore !== null && game.teamBScore !== null) {
                    if (game.teamAScore > game.teamBScore) {
                      teamAWins++;
                    } else if (game.teamBScore > game.teamAScore) {
                      teamBWins++;
                    }
                  }
                });

                if (teamAWins >= 3) {
                  winnerId = match.teamAId;
                } else if (teamBWins >= 3) {
                  winnerId = match.teamBId;
                }
              }
            }

            return {
              id: match.id,
              teamA: match.teamA,
              teamB: match.teamB,
              seedA: match.seedA,
              seedB: match.seedB,
              isBye: match.isBye,
              winnerId,
              sourceMatchAId: match.sourceMatchAId,
              sourceMatchBId: match.sourceMatchBId,
              games: match.games.map(game => ({
                id: game.id,
                slot: game.slot,
                teamAScore: game.teamAScore,
                teamBScore: game.teamBScore,
                isComplete: game.isComplete ?? false,
                startedAt: game.startedAt,
                teamALineup: (game as any).teamALineup || [],
                teamBLineup: (game as any).teamBLineup || []
              }))
            };
          })
        }));

        return transformedRounds;
      },
      CACHE_TTL.STOP_SCOREBOARD
    );

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching bracket data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bracket data' },
      { status: 500 }
    );
  }
}
