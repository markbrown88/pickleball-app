// src/app/api/public/stops/[stopId]/scoreboard/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCached, cacheKeys, CACHE_TTL } from '@/lib/cache';

type Params = { stopId: string };

function ymd(d?: Date | null): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { stopId } = await ctx.params;

    // Cache scoreboard data (30 second TTL for real-time updates during tournaments)
    const payload = await getCached(
      cacheKeys.stopScoreboard(stopId),
      async () => {
        // Stop header + context
        const stop = await prisma.stop.findUnique({
          where: { id: stopId },
          select: {
            id: true,
            name: true,
            startAt: true,
            endAt: true,
            club: { select: { name: true } },
            tournament: { select: { id: true, name: true } },
          },
        });

        if (!stop) {
          throw new Error('Stop not found');
        }

        // Rounds → Matches → Games (correct hierarchy, no transformation needed)
        const rounds = await prisma.round.findMany({
      where: { stopId },
      orderBy: { idx: 'asc' },
      include: {
        lineups: {
          include: {
            entries: {
              include: {
                player1: {
                  select: {
                    id: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    gender: true
                  }
                },
                player2: {
                  select: {
                    id: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    gender: true
                  }
                }
              }
            }
          }
        },
        matches: {
          orderBy: [
            { updatedAt: 'desc' }, // Most recently completed matches first
            { id: 'asc' } // Fallback to ID for matches with same completion time
          ],
          select: {
            id: true,
            isBye: true,
            forfeitTeam: true,
            updatedAt: true,
            tiebreakerStatus: true,
            tiebreakerWinnerTeamId: true,
              totalPointsTeamA: true,
              totalPointsTeamB: true,
            teamA: { 
              select: { 
                id: true, 
                name: true, 
                clubId: true,
                stopRosterLinks: {
                  where: { stopId: stopId },
                  include: {
                    player: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        name: true,
                        gender: true
                      }
                    }
                  }
                }
              } 
            },
            teamB: { 
              select: { 
                id: true, 
                name: true, 
                clubId: true,
                stopRosterLinks: {
                  where: { stopId: stopId },
                  include: {
                    player: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        name: true,
                        gender: true
                      }
                    }
                  }
                }
              } 
            },
            games: { 
              orderBy: { slot: 'asc' },
              include: {
                match: {
                  select: {
                    teamA: {
                      select: {
                        stopRosterLinks: {
                          where: { stopId: stopId },
                          include: {
                            player: {
                              select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                name: true,
                                gender: true
                              }
                            }
                          }
                        }
                      }
                    },
                    teamB: {
                      select: {
                        stopRosterLinks: {
                          where: { stopId: stopId },
                          include: {
                            player: {
                              select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                name: true,
                                gender: true
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
          },
        },
      },
    });

        // Shape & compute small summary (wins per match)
        return {
          stop: {
            id: stop.id,
            name: stop.name,
            tournamentId: stop.tournament?.id ?? null,
            tournamentName: stop.tournament?.name ?? null,
            locationName: stop.club?.name ?? null,
            startAt: ymd(stop.startAt),
            endAt: ymd(stop.endAt),
          },
          rounds: rounds.map((r: any) => {
        // Debug: Log the order of matches for this round
        console.log(`[SCOREBOARD] Round ${r.idx} matches order:`, r.matches.map((m: any) => ({
          id: m.id,
          updatedAt: m.updatedAt?.toISOString(),
          forfeitTeam: m.forfeitTeam,
          tiebreakerStatus: m.tiebreakerStatus,
          tiebreakerWinnerTeamId: m.tiebreakerWinnerTeamId
        })));
        
        return {
          roundId: r.id,
          idx: r.idx,
          matches: r.matches.map((match: any) => {
          const wins = { a: 0, b: 0, ties: 0 };
          for (const game of match.games) {
            const a = game.teamAScore ?? null;
            const b = game.teamBScore ?? null;
            if (a == null || b == null) continue;
            if (a > b) wins.a += 1;
            else if (b > a) wins.b += 1;
            else wins.ties += 1;
          }

          // Debug logging for forfeited matches
          if (match.forfeitTeam) {
            console.log(`[SCOREBOARD] Forfeited match ${match.id}: forfeitTeam=${match.forfeitTeam}, updatedAt=${match.updatedAt?.toISOString()}`);
          }

          return {
            matchId: match.id,
            isBye: match.isBye,
            forfeitTeam: match.forfeitTeam,
            tiebreakerStatus: match.tiebreakerStatus,
            tiebreakerWinnerTeamId: match.tiebreakerWinnerTeamId,
            totalPointsTeamA: match.totalPointsTeamA,
            totalPointsTeamB: match.totalPointsTeamB,
            teamA: match.teamA ? { 
              id: match.teamA.id, 
              name: match.teamA.name, 
              clubId: match.teamA.clubId,
              players: match.teamA.stopRosterLinks?.map((link: any) => ({
                id: link.player.id,
                firstName: link.player.firstName,
                lastName: link.player.lastName,
                name: link.player.name,
                gender: link.player.gender
              })) || []
            } : null,
            teamB: match.teamB ? { 
              id: match.teamB.id, 
              name: match.teamB.name, 
              clubId: match.teamB.clubId,
              players: match.teamB.stopRosterLinks?.map((link: any) => ({
                id: link.player.id,
                firstName: link.player.firstName,
                lastName: link.player.lastName,
                name: link.player.name,
                gender: link.player.gender
              })) || []
            } : null,
            games: match.games.map((game: any) => {
              // Get lineup data: prefer game-level lineups, fallback to round-level lineups
              let teamALineup = [];
              let teamBLineup = [];

              // First, try to get from game.teamALineup (stored on game itself)
              if (game.teamALineup && Array.isArray(game.teamALineup) && game.teamALineup.length > 0) {
                teamALineup = game.teamALineup;
              } else {
                // Fallback to round-level lineup (Lineup/LineupEntry system)
                const teamALineupData = r.lineups?.find((l: any) => l.teamId === match.teamA?.id);
                if (teamALineupData) {
                  const mensDoubles = teamALineupData.entries.find((e: any) => e.slot === 'MENS_DOUBLES');
                  const womensDoubles = teamALineupData.entries.find((e: any) => e.slot === 'WOMENS_DOUBLES');

                  const lineup = new Array(4).fill(null);
                  if (mensDoubles) {
                    if (mensDoubles.player1) lineup[0] = mensDoubles.player1;
                    if (mensDoubles.player2) lineup[1] = mensDoubles.player2;
                  }
                  if (womensDoubles) {
                    if (womensDoubles.player1) lineup[2] = womensDoubles.player1;
                    if (womensDoubles.player2) lineup[3] = womensDoubles.player2;
                  }

                  // Extract players for this game slot
                  if (game.slot === 'MENS_DOUBLES') {
                    teamALineup = [lineup[0], lineup[1]].filter(Boolean);
                  } else if (game.slot === 'WOMENS_DOUBLES') {
                    teamALineup = [lineup[2], lineup[3]].filter(Boolean);
                  } else if (game.slot === 'MIXED_1') {
                    teamALineup = [lineup[0], lineup[2]].filter(Boolean);
                  } else if (game.slot === 'MIXED_2') {
                    teamALineup = [lineup[1], lineup[3]].filter(Boolean);
                  }
                }
              }

              // Same for Team B
              if (game.teamBLineup && Array.isArray(game.teamBLineup) && game.teamBLineup.length > 0) {
                teamBLineup = game.teamBLineup;
              } else {
                // Fallback to round-level lineup
                const teamBLineupData = r.lineups?.find((l: any) => l.teamId === match.teamB?.id);
                if (teamBLineupData) {
                  const mensDoubles = teamBLineupData.entries.find((e: any) => e.slot === 'MENS_DOUBLES');
                  const womensDoubles = teamBLineupData.entries.find((e: any) => e.slot === 'WOMENS_DOUBLES');

                  const lineup = new Array(4).fill(null);
                  if (mensDoubles) {
                    if (mensDoubles.player1) lineup[0] = mensDoubles.player1;
                    if (mensDoubles.player2) lineup[1] = mensDoubles.player2;
                  }
                  if (womensDoubles) {
                    if (womensDoubles.player1) lineup[2] = womensDoubles.player1;
                    if (womensDoubles.player2) lineup[3] = womensDoubles.player2;
                  }

                  // Extract players for this game slot
                  if (game.slot === 'MENS_DOUBLES') {
                    teamBLineup = [lineup[0], lineup[1]].filter(Boolean);
                  } else if (game.slot === 'WOMENS_DOUBLES') {
                    teamBLineup = [lineup[2], lineup[3]].filter(Boolean);
                  } else if (game.slot === 'MIXED_1') {
                    teamBLineup = [lineup[0], lineup[2]].filter(Boolean);
                  } else if (game.slot === 'MIXED_2') {
                    teamBLineup = [lineup[1], lineup[3]].filter(Boolean);
                  }
                }
              }

              return {
                id: game.id,
                slot: game.slot, // GameSlot
                teamAScore: game.teamAScore,
                teamBScore: game.teamBScore,
                isComplete: game.isComplete,
                courtNumber: game.courtNumber ?? null,
                startedAt: game.startedAt ? game.startedAt.toISOString() : null,
                endedAt: game.endedAt ? game.endedAt.toISOString() : null,
                updatedAt: game.updatedAt ? game.updatedAt.toISOString() : null,
                createdAt: game.createdAt ? game.createdAt.toISOString() : null,
                lineupConfirmed: game.lineupConfirmed ?? false,
                teamALineup: teamALineup.map((player: any) => ({
                  id: player.id,
                  firstName: player.firstName,
                  lastName: player.lastName,
                  name: player.name,
                  gender: player.gender
                })),
                teamBLineup: teamBLineup.map((player: any) => ({
                  id: player.id,
                  firstName: player.firstName,
                  lastName: player.lastName,
                  name: player.name,
                  gender: player.gender
                })),
              };
            }),
            summary: wins,
          };
        }),
        };
          }),
        };
      },
      CACHE_TTL.SCORES // 30 seconds for real-time updates
    );

    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    // Handle 'Stop not found' error specifically
    if (msg === 'Stop not found') {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
