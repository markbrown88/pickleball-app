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

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { stopId } = await ctx.params;

    // Check for cache-busting parameter
    const url = new URL(req.url);
    const bustCache = url.searchParams.has('nocache');

    // Cache scoreboard data (30 second TTL for real-time updates during tournaments)
    // Skip cache if nocache parameter is present
    const cacheKey = bustCache ? `${cacheKeys.stopScoreboard(stopId)}_${Date.now()}` : cacheKeys.stopScoreboard(stopId);
    const payload = await getCached(
      cacheKey,
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

        // Load lineups using the same logic as the admin lineups API
        // This ensures consistent lineup loading for all tournament types
        const groupedLineups: Record<string, Record<string, any[]>> = {};

        // Get all matches for this stop with their games
        const matchesForLineups = await prisma.match.findMany({
          where: { round: { stopId } },
          include: {
            teamA: { select: { id: true } },
            teamB: { select: { id: true } },
            games: { select: { bracketId: true } },
            round: { select: { id: true, stopId: true } }
          }
        });

        // Load ALL lineups for this stop
        const allLineups = await prisma.lineup.findMany({
          where: { stopId },
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
        });

        const formatPlayer = (p: any) => p ? {
          id: p.id,
          name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
          gender: p.gender,
        } : undefined;

        const formatLineup = (lineupData: any) => {
          const lineup = new Array(4).fill(undefined);
          const mensDoubles = lineupData.entries.find((e: any) => e.slot === 'MENS_DOUBLES');
          const womensDoubles = lineupData.entries.find((e: any) => e.slot === 'WOMENS_DOUBLES');

          if (mensDoubles) {
            if (mensDoubles.player1) lineup[0] = formatPlayer(mensDoubles.player1);
            if (mensDoubles.player2) lineup[1] = formatPlayer(mensDoubles.player2);
          }
          if (womensDoubles) {
            if (womensDoubles.player1) lineup[2] = formatPlayer(womensDoubles.player1);
            if (womensDoubles.player2) lineup[3] = formatPlayer(womensDoubles.player2);
          }
          return lineup;
        };

        // Debug: Log all lineups loaded from database
        console.log('[Scoreboard] Total lineups loaded:', allLineups.length);
        allLineups.forEach(l => {
          console.log(`[Scoreboard] Lineup: id=${l.id}, teamId=${l.teamId}, bracketId=${l.bracketId}, stopId=${l.stopId}`);
        });

        // Process lineups for each match (same logic as admin API)
        for (const match of matchesForLineups) {
          const bracketIds = [...new Set(match.games.map(g => g.bracketId).filter(Boolean))];
          const hasBrackets = bracketIds.length > 0;

          console.log(`[Scoreboard] Processing match ${match.id}, hasBrackets=${hasBrackets}, bracketIds=[${bracketIds.join(', ')}]`);

          if (hasBrackets) {
            for (const bracketId of bracketIds) {
              const bracketLineups = allLineups.filter(l => l.bracketId === bracketId);
              console.log(`[Scoreboard] For bracketId ${bracketId}, found ${bracketLineups.length} lineups`);

              if (bracketLineups.length > 0) {
                if (!groupedLineups[bracketId!]) {
                  groupedLineups[bracketId!] = {};
                }
                for (const lineupData of bracketLineups) {
                  const formattedLineup = formatLineup(lineupData);
                  groupedLineups[bracketId!][lineupData.teamId] = formattedLineup;
                  console.log(`[Scoreboard] Added lineup for teamId ${lineupData.teamId} to bracket ${bracketId}:`, formattedLineup.map(p => p?.name || 'null'));
                }
              }
            }
          } else {
            if (!match.teamA || !match.teamB) continue;
            const teamALineupData = allLineups.find(l =>
              l.teamId === match.teamA!.id && !l.bracketId && l.roundId === match.roundId
            );
            const teamBLineupData = allLineups.find(l =>
              l.teamId === match.teamB!.id && !l.bracketId && l.roundId === match.roundId
            );

            if (teamALineupData || teamBLineupData) {
              if (!groupedLineups[match.id]) {
                groupedLineups[match.id] = {};
              }
              if (teamALineupData) {
                groupedLineups[match.id][match.teamA.id] = formatLineup(teamALineupData);
              }
              if (teamBLineupData) {
                groupedLineups[match.id][match.teamB.id] = formatLineup(teamBLineupData);
              }
            }
          }
        }

        const lineupsData = groupedLineups;

        // Load ALL teams for this tournament (needed for DE Clubs to map clubId+bracketId to teamId)
        const allTeams = await prisma.team.findMany({
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
                bracket: {
                  select: {
                    id: true,
                    name: true
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
              // Get lineup data from the admin lineups API (same source as manager page)
              let teamALineup: any[] = [];
              let teamBLineup: any[] = [];

              const gameBracketId = game.bracketId || null;

              console.log(`[Scoreboard] Processing game ${game.id}, slot=${game.slot}, bracketId=${gameBracketId}`);

              // Find the correct team IDs for this bracket
              let teamAIdForBracket = match.teamA?.id;
              let teamBIdForBracket = match.teamB?.id;

              if (gameBracketId && match.teamA?.clubId && match.teamB?.clubId) {
                console.log(`[Scoreboard] Looking for teams with clubId ${match.teamA.clubId} and ${match.teamB.clubId} in bracket ${gameBracketId}`);

                // Find teams by clubId + bracketId
                const teamAForBracket = allTeams.find((t: any) =>
                  t.clubId === match.teamA.clubId && t.bracketId === gameBracketId
                );
                const teamBForBracket = allTeams.find((t: any) =>
                  t.clubId === match.teamB.clubId && t.bracketId === gameBracketId
                );

                console.log(`[Scoreboard] Found teamAForBracket:`, teamAForBracket);
                console.log(`[Scoreboard] Found teamBForBracket:`, teamBForBracket);

                if (teamAForBracket) teamAIdForBracket = teamAForBracket.id;
                if (teamBForBracket) teamBIdForBracket = teamBForBracket.id;
              }

              console.log(`[Scoreboard] Using teamAIdForBracket=${teamAIdForBracket}, teamBIdForBracket=${teamBIdForBracket}`);

              // Get lineups from the admin API response
              // For bracket-aware: lineupsData[bracketId][teamId]
              // For regular matches: lineupsData[matchId][teamId]
              const lineupKey = gameBracketId || match.id;
              const bracketLineups = lineupsData[lineupKey] || {};

              console.log(`[Scoreboard] lineupKey=${lineupKey}, bracketLineups keys:`, Object.keys(bracketLineups));

              // Get Team A lineup
              const teamALineupArray = bracketLineups[teamAIdForBracket] || [];
              console.log(`[Scoreboard] teamALineupArray length: ${teamALineupArray.length}`, teamALineupArray.map((p: any) => p?.name));

              if (teamALineupArray.length === 4) {
                // Extract players for this game slot
                if (game.slot === 'MENS_DOUBLES') {
                  teamALineup = [teamALineupArray[0], teamALineupArray[1]].filter(Boolean);
                } else if (game.slot === 'WOMENS_DOUBLES') {
                  teamALineup = [teamALineupArray[2], teamALineupArray[3]].filter(Boolean);
                } else if (game.slot === 'MIXED_1') {
                  teamALineup = [teamALineupArray[0], teamALineupArray[2]].filter(Boolean);
                } else if (game.slot === 'MIXED_2') {
                  teamALineup = [teamALineupArray[1], teamALineupArray[3]].filter(Boolean);
                }
              }

              // Get Team B lineup
              const teamBLineupArray = bracketLineups[teamBIdForBracket] || [];
              console.log(`[Scoreboard] teamBLineupArray length: ${teamBLineupArray.length}`, teamBLineupArray.map((p: any) => p?.name));

              if (teamBLineupArray.length === 4) {
                // Extract players for this game slot
                if (game.slot === 'MENS_DOUBLES') {
                  teamBLineup = [teamBLineupArray[0], teamBLineupArray[1]].filter(Boolean);
                } else if (game.slot === 'WOMENS_DOUBLES') {
                  teamBLineup = [teamBLineupArray[2], teamBLineupArray[3]].filter(Boolean);
                } else if (game.slot === 'MIXED_1') {
                  teamBLineup = [teamBLineupArray[0], teamBLineupArray[2]].filter(Boolean);
                } else if (game.slot === 'MIXED_2') {
                  teamBLineup = [teamBLineupArray[1], teamBLineupArray[3]].filter(Boolean);
                }
              }

              console.log(`[Scoreboard] Final teamALineup length: ${teamALineup.length}, teamBLineup length: ${teamBLineup.length}`);

              const mappedTeamALineup = teamALineup.map((player: any) => ({
                id: player.id,
                firstName: player.firstName,
                lastName: player.lastName,
                name: player.name,
                gender: player.gender
              }));
              const mappedTeamBLineup = teamBLineup.map((player: any) => ({
                id: player.id,
                firstName: player.firstName,
                lastName: player.lastName,
                name: player.name,
                gender: player.gender
              }));

              console.log(`[Scoreboard] Mapped teamALineup length: ${mappedTeamALineup.length}`, JSON.stringify(mappedTeamALineup));
              console.log(`[Scoreboard] Mapped teamBLineup length: ${mappedTeamBLineup.length}`, JSON.stringify(mappedTeamBLineup));

              return {
                id: game.id,
                slot: game.slot, // GameSlot
                bracketId: game.bracketId ?? null,
                bracket: game.bracket ? {
                  id: game.bracket.id,
                  name: game.bracket.name
                } : null,
                teamAScore: game.teamAScore,
                teamBScore: game.teamBScore,
                isComplete: game.isComplete,
                courtNumber: game.courtNumber ?? null,
                startedAt: game.startedAt ? game.startedAt.toISOString() : null,
                endedAt: game.endedAt ? game.endedAt.toISOString() : null,
                updatedAt: game.updatedAt ? game.updatedAt.toISOString() : null,
                createdAt: game.createdAt ? game.createdAt.toISOString() : null,
                teamALineup: mappedTeamALineup,
                teamBLineup: mappedTeamBLineup,
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
