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
        // Get stop with tournament type
        const stop = await prisma.stop.findUnique({
          where: { id: stopId },
          select: {
            tournament: {
              select: {
                type: true
              }
            }
          }
        });

        const tournamentType = stop?.tournament?.type;

        // Fetch all rounds with matches and games
        const rounds = await prisma.round.findMany({
          where: { stopId },
          orderBy: { idx: 'asc' },
          include: {
            matches: {
              orderBy: { id: 'asc' },
              select: {
                id: true,
                seedA: true,
                seedB: true,
                isBye: true,
                winnerId: true,
                forfeitTeam: true,
                tiebreakerWinnerTeamId: true,
                sourceMatchAId: true,
                sourceMatchBId: true,
                teamAId: true,
                teamBId: true,
                teamA: {
                  select: {
                    id: true,
                    name: true,
                    clubId: true,
                    club: { select: { name: true } }
                  }
                },
                teamB: {
                  select: {
                    id: true,
                    name: true,
                    clubId: true,
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
                    updatedAt: true,
                    createdAt: true,
                    courtNumber: true,
                    bracketId: true,
                    bracket: {
                      select: {
                        id: true,
                        name: true,
                      }
                    }
                  }
                }
              }
            }
          }
        });

        // For DE Clubs tournaments, we need to fetch lineups by stopId + bracketId
        // For other tournaments, fetch by roundId as before
        const isDeClubs = tournamentType === 'DOUBLE_ELIMINATION_CLUBS';

        let lineupsByStopAndBracket = new Map<string, Map<string, any>>();
        let lineupsByRound = new Map();

        // For DE Clubs, load all teams to map clubId + bracketId -> teamId
        let allTeams: any[] = [];
        if (isDeClubs) {
          allTeams = await prisma.team.findMany({
            where: {
              tournament: {
                stops: {
                  some: { id: stopId }
                }
              }
            },
            select: {
              id: true,
              clubId: true,
              bracketId: true,
              name: true
            }
          });
        }

        if (isDeClubs) {
          // Fetch all lineups for this stop (bracket-aware)
          const allLineups = await prisma.lineup.findMany({
            where: { stopId },
            include: {
              entries: {
                include: {
                  player1: { select: { id: true, name: true, gender: true } },
                  player2: { select: { id: true, name: true, gender: true } },
                },
              },
            },
          });

          // Group lineups by bracketId -> teamId -> lineup
          for (const lineup of allLineups) {
            const bracketKey = lineup.bracketId || 'main';
            if (!lineupsByStopAndBracket.has(bracketKey)) {
              lineupsByStopAndBracket.set(bracketKey, new Map());
            }

            const mensDoubles = lineup.entries.find((e) => e.slot === 'MENS_DOUBLES');
            const womensDoubles = lineup.entries.find((e) => e.slot === 'WOMENS_DOUBLES');

            if (mensDoubles?.player1 && mensDoubles?.player2 && womensDoubles?.player1 && womensDoubles?.player2) {
              const coreLineup = [
                mensDoubles.player1,
                mensDoubles.player2,
                womensDoubles.player1,
                womensDoubles.player2,
              ];
              lineupsByStopAndBracket.get(bracketKey)!.set(lineup.teamId, coreLineup);
            }
          }
        } else {
          // Standard tournament - fetch lineups by round
          for (const round of rounds) {
            const lineups = await getLineupsForRound(prisma, round.id);
            lineupsByRound.set(round.id, lineups);
          }
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
              // Determine winner: use database winnerId if set, otherwise calculate
              let winnerId: string | null = null;

              if (match.winnerId) {
                // Use the winnerId from the database if it's set
                winnerId = match.winnerId;
              } else if (match.forfeitTeam) {
                // Forfeit: the non-forfeiting team wins
                winnerId = match.forfeitTeam === 'A' ? match.teamBId : match.teamAId;
              } else if (match.tiebreakerWinnerTeamId) {
                // Tiebreaker decided
                winnerId = match.tiebreakerWinnerTeamId;
              } else {
                // Calculate winner based on game wins
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

                // Only set winnerId if one team has MORE wins AND has won at least 3 games
                // This prevents marking a 3-3 tie as complete
                if (teamAWins >= 3 && teamAWins > teamBWins) {
                  winnerId = match.teamAId;
                } else if (teamBWins >= 3 && teamBWins > teamAWins) {
                  winnerId = match.teamBId;
                }
                // If teamAWins === teamBWins, winnerId remains null (tied match)
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
                games: match.games.map((game: any) => {
                  // Get lineups for this game based on tournament type
                  let teamALineup = null;
                  let teamBLineup = null;

                  if (isDeClubs && game.bracketId) {
                    // DE Clubs: lookup by bracketId -> teamId
                    // First, find the bracket-specific team IDs for this game's bracket
                    let teamAIdForBracket = match.teamAId;
                    let teamBIdForBracket = match.teamBId;

                    // Look up bracket-specific team for Team A
                    if (match.teamA?.clubId) {
                      const teamAForBracket = allTeams.find((t: any) =>
                        t.clubId === match.teamA.clubId && t.bracketId === game.bracketId
                      );
                      if (teamAForBracket) teamAIdForBracket = teamAForBracket.id;
                    }

                    // Look up bracket-specific team for Team B (if it exists)
                    if (match.teamB?.clubId) {
                      const teamBForBracket = allTeams.find((t: any) =>
                        t.clubId === match.teamB.clubId && t.bracketId === game.bracketId
                      );
                      if (teamBForBracket) teamBIdForBracket = teamBForBracket.id;
                    }

                    const bracketLineups = lineupsByStopAndBracket.get(game.bracketId);
                    if (bracketLineups) {
                      teamALineup = teamAIdForBracket ? bracketLineups.get(teamAIdForBracket) || null : null;
                      teamBLineup = teamBIdForBracket ? bracketLineups.get(teamBIdForBracket) || null : null;
                    }
                  } else {
                    // Standard tournament: lookup by roundId -> teamId
                    teamALineup = match.teamAId ? roundLineups.get(match.teamAId) : null;
                    teamBLineup = match.teamBId ? roundLineups.get(match.teamBId) : null;
                  }

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
                    endedAt: game.endedAt,
                    updatedAt: game.updatedAt,
                    createdAt: game.createdAt,
                    courtNumber: game.courtNumber,
                    bracketId: game.bracketId,
                    bracket: game.bracket,
                    teamALineup: [teamAPlayer1, teamAPlayer2].filter(Boolean),
                    teamBLineup: [teamBPlayer1, teamBPlayer2].filter(Boolean)
                  };
                })
              };
            })
          };
        });

        return {
          rounds: transformedRounds,
          tournamentType
        };
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
