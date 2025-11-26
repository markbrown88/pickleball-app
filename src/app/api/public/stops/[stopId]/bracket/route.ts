// Public Bracket API - Returns bracket structure for double elimination tournaments
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCached, cacheKeys, CACHE_TTL } from '@/lib/cache';
import { getLineupsForRound, getPlayersForSlot } from '@/lib/lineupHelpers';

type Ctx = { params: Promise<{ stopId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { stopId } = await ctx.params;

    // Cache bracket data (30 second TTL for real-time updates during tournaments)
    const payload = await getCached(
      cacheKeys.stopSchedule(stopId),
      async () => {
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
                  }
                }
              }
            }
          }
        });

        // Load lineups for all rounds
        const lineupsByRound = new Map();
        for (const round of rounds) {
          const lineups = await getLineupsForRound(prisma, round.id);
          lineupsByRound.set(round.id, lineups);
        }

        // Transform rounds to include winnerId and lineups
        const transformedRounds = rounds.map((round: any) => {
          const roundLineups = lineupsByRound.get(round.id) || new Map();

          return {
            id: round.id,
            idx: round.idx,
            bracketType: round.bracketType,
            depth: round.depth,
            matches: round.matches.map((match: any) => {
              // Calculate winner based on games
              let winnerId: string | null = null;

              if (match.forfeitTeam) {
                winnerId = match.forfeitTeam === 'A' ? match.teamBId : match.teamAId;
              } else {
                // Count game wins
                let teamAWins = 0;
                let teamBWins = 0;

                match.games.forEach((game: any) => {
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

              // Get lineups for this match's teams
              const teamALineup = match.teamAId ? roundLineups.get(match.teamAId) : null;
              const teamBLineup = match.teamBId ? roundLineups.get(match.teamBId) : null;

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
                games: match.games.map((game: any) => {
                  // Get players for this specific game slot
                  const [teamAPlayer1, teamAPlayer2] = getPlayersForSlot(teamALineup, game.slot);
                  const [teamBPlayer1, teamBPlayer2] = getPlayersForSlot(teamBLineup, game.slot);

                  return {
                    id: game.id,
                    slot: game.slot,
                    teamAScore: game.teamAScore,
                    teamBScore: game.teamBScore,
                    isComplete: game.isComplete ?? false,
                    startedAt: game.startedAt,
                    teamALineup: [teamAPlayer1, teamAPlayer2].filter(Boolean),
                    teamBLineup: [teamBPlayer1, teamBPlayer2].filter(Boolean)
                  };
                })
              };
            })
          };
        });

        return transformedRounds;
      },
      CACHE_TTL.SCHEDULE
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
