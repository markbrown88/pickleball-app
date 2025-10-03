// src/app/api/public/stops/[stopId]/scoreboard/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    // Use singleton prisma instance

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
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    // Rounds → Matches → Games (correct hierarchy, no transformation needed)
    const rounds = await prisma.round.findMany({
      where: { stopId },
      orderBy: { idx: 'asc' },
      include: {
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
    const payload = {
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
          forfeitTeam: m.forfeitTeam
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
              // Get the specific players for this game based on the game slot
              const teamAPlayers = match.teamA?.stopRosterLinks?.map((link: any) => link.player) || [];
              const teamBPlayers = match.teamB?.stopRosterLinks?.map((link: any) => link.player) || [];
              
              // Filter players based on game type
              let teamALineup = [];
              let teamBLineup = [];
              
              if (game.slot === 'MENS_DOUBLES') {
                teamALineup = teamAPlayers.filter((p: any) => p.gender === 'MALE').slice(0, 2);
                teamBLineup = teamBPlayers.filter((p: any) => p.gender === 'MALE').slice(0, 2);
              } else if (game.slot === 'WOMENS_DOUBLES') {
                teamALineup = teamAPlayers.filter((p: any) => p.gender === 'FEMALE').slice(0, 2);
                teamBLineup = teamBPlayers.filter((p: any) => p.gender === 'FEMALE').slice(0, 2);
              } else if (game.slot === 'MIXED_1' || game.slot === 'MIXED_2') {
                // Mixed doubles: 1 male + 1 female
                const teamAMale = teamAPlayers.filter((p: any) => p.gender === 'MALE')[0];
                const teamAFemale = teamAPlayers.filter((p: any) => p.gender === 'FEMALE')[0];
                const teamBMale = teamBPlayers.filter((p: any) => p.gender === 'MALE')[0];
                const teamBFemale = teamBPlayers.filter((p: any) => p.gender === 'FEMALE')[0];
                
                teamALineup = [teamAMale, teamAFemale].filter(Boolean);
                teamBLineup = [teamBMale, teamBFemale].filter(Boolean);
              } else if (game.slot === 'TIEBREAKER') {
                // Tiebreaker: show team names, not specific players
                teamALineup = [];
                teamBLineup = [];
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

    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
