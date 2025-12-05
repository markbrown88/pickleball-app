import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCached, cacheKeys, CACHE_TTL } from '@/lib/cache';
import { captainPortalLimiter, getClientIp, checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/captain-portal/[token]/match
 *
 * For DOUBLE_ELIMINATION_CLUBS tournaments:
 * Returns the current active match for the club across all skill brackets.
 *
 * A match is considered "active" when:
 * 1. Both teamAId AND teamBId are not null (both teams have been placed)
 * 2. The match is not complete (winnerId is null)
 * 3. It's the earliest match by bracket depth/round progression
 */
export async function GET(request: Request, { params }: Params) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(captainPortalLimiter, clientIp);

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const { token } = await params;

    // Find tournament club by access token
    const tournamentClub = await prisma.tournamentClub.findUnique({
      where: { captainAccessToken: token },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        club: {
          select: {
            id: true,
            name: true
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

    // TEMPORARILY DISABLED CACHE FOR DEBUGGING
    // Use cache to reduce database load (shorter TTL for match data)
    // const result = await getCached(
    //   cacheKeys.captainPortal(token) + ':match',
    //   async () => {
    const result = await (async () => {
      // Get all teams for this club (one per bracket)
      const teams = await prisma.team.findMany({
        where: {
          tournamentId: tournamentClub.tournamentId,
          clubId: tournamentClub.clubId
        },
        include: {
          bracket: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      console.log(`[Captain Portal] Teams for club ${tournamentClub.club.name}:`,
        teams.map(t => ({
          teamId: t.id,
          teamName: t.name,
          bracketId: t.bracketId,
          bracketName: t.bracket?.name
        }))
      );

      if (teams.length === 0) {
        return {
          tournament: {
            id: tournamentClub.tournament.id,
            name: tournamentClub.tournament.name,
            type: tournamentClub.tournament.type
          },
          club: {
            id: tournamentClub.club.id,
            name: tournamentClub.club.name
          },
          match: null,
          brackets: [],
          message: 'No teams found for this club'
        };
      }

      const teamIds = teams.map(t => t.id);

      // Find current active matches where:
      // - Both teams are placed (teamAId AND teamBId not null)
      // - Match is not complete (winnerId is null)
      // - Team belongs to this club
      const matches = await prisma.match.findMany({
        where: {
          OR: teamIds.map(teamId => ({
            OR: [
              { teamAId: teamId },
              { teamBId: teamId }
            ]
          })),
          teamAId: { not: null },
          teamBId: { not: null },
          winnerId: null
        },
        include: {
          teamA: {
            include: {
              club: { select: { id: true, name: true } },
              bracket: { select: { id: true, name: true } }
            }
          },
          teamB: {
            include: {
              club: { select: { id: true, name: true } },
              bracket: { select: { id: true, name: true } }
            }
          },
          round: {
            include: {
              stop: {
                select: {
                  id: true,
                  name: true,
                  startAt: true,
                  club: { select: { id: true, name: true } }
                }
              }
            }
          },
          games: {
            include: {
              bracket: { select: { id: true, name: true } }
            },
            orderBy: { slot: 'asc' }
          }
        },
        orderBy: [
          { round: { depth: 'asc' } },
          { round: { idx: 'asc' } }
        ]
      });

      if (matches.length === 0) {
        return {
          tournament: {
            id: tournamentClub.tournament.id,
            name: tournamentClub.tournament.name,
            type: tournamentClub.tournament.type
          },
          club: {
            id: tournamentClub.club.id,
            name: tournamentClub.club.name
          },
          match: null,
          brackets: [],
          message: 'No active matches. Waiting for next round.'
        };
      }

      // Get the first match (earliest by depth/idx)
      const currentMatch = matches[0];

      // Determine which team is the opponent
      const isTeamA = currentMatch.teamA?.clubId === tournamentClub.clubId;
      const myTeams = isTeamA ?
        matches.map(m => m.teamA).filter((t): t is NonNullable<typeof t> => t !== null && t !== undefined) :
        matches.map(m => m.teamB).filter((t): t is NonNullable<typeof t> => t !== null && t !== undefined);

      const opponent = isTeamA ? currentMatch.teamB : currentMatch.teamA;

      // For DE Clubs tournaments, fetch ALL teams for the opponent club (not just from match data)
      // This ensures we get teams from all brackets
      const opponentClubId = opponent?.clubId;
      const opponentTeams = opponentClubId ? await prisma.team.findMany({
        where: {
          tournamentId: tournamentClub.tournamentId,
          clubId: opponentClubId
        },
        include: {
          bracket: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }) : [];

      // Check if any game has started
      const hasStarted = currentMatch.games.some(g => g.startedAt !== null);

      // Get all bracket IDs involved in this match
      // Sort brackets to match /manager page order (reverse alphabetical = lowest to highest skill)
      const bracketIds = [...new Set(currentMatch.games.map(g => g.bracketId).filter(Boolean) as string[])].sort((a, b) => {
        // Get bracket names for sorting
        const gameA = currentMatch.games.find(g => g.bracketId === a);
        const gameB = currentMatch.games.find(g => g.bracketId === b);
        const nameA = gameA?.bracket?.name || '';
        const nameB = gameB?.bracket?.name || '';
        // Sort descending (Z to A) so Intermediate comes before Advanced
        return nameB.localeCompare(nameA);
      });

      // Debug: Check what lineups exist for this round
      const allLineupsForRound = await prisma.lineup.findMany({
        where: { roundId: currentMatch.roundId },
        select: {
          id: true,
          roundId: true,
          teamId: true,
          bracketId: true,
          team: { select: { name: true, bracketId: true, clubId: true } }
        }
      });
      console.log(`[Captain Portal] All lineups for roundId ${currentMatch.roundId}:`,
        allLineupsForRound.map(l => ({
          lineupId: l.id,
          teamId: l.teamId,
          teamName: l.team.name,
          teamBracketId: l.team.bracketId,
          teamClubId: l.team.clubId,
          lineupBracketId: l.bracketId
        }))
      );

      // Debug: Check ALL lineups for this stop (might have different roundId)
      const allLineupsForStop = await prisma.lineup.findMany({
        where: { stopId: currentMatch.round.stop.id },
        select: {
          id: true,
          roundId: true,
          stopId: true,
          teamId: true,
          bracketId: true,
          team: { select: { name: true, bracketId: true, clubId: true } }
        }
      });
      console.log(`[Captain Portal] ALL lineups for stopId ${currentMatch.round.stop.id}:`,
        allLineupsForStop.map(l => ({
          lineupId: l.id,
          roundId: l.roundId,
          stopId: l.stopId,
          teamId: l.teamId,
          teamName: l.team.name,
          lineupBracketId: l.bracketId
        }))
      );

      // For each bracket, get roster, lineup, and games
      const bracketsData = await Promise.all(
        bracketIds.map(async (bracketId) => {
          // Find the team for this bracket
          const team = teams.find(t => t.bracketId === bracketId);
          if (!team) return null;

          // Get roster for this team
          const roster = await prisma.stopTeamPlayer.findMany({
            where: {
              stopId: currentMatch.round.stop.id,
              teamId: team.id
            },
            include: {
              player: {
                select: {
                  id: true,
                  name: true,
                  gender: true
                }
              }
            }
          });

          // Get lineup for this bracket if exists
          // For DE Clubs tournaments, query by stopId instead of roundId since rounds may differ
          console.log(`[Captain Portal] Looking for lineup: stopId=${currentMatch.round.stop.id}, teamId=${team.id}, teamName=${team.name}, bracketId=${bracketId}`);

          const lineupData = await prisma.lineup.findFirst({
            where: {
              stopId: currentMatch.round.stop.id,
              teamId: team.id,
              bracketId: bracketId
            },
            include: {
              entries: {
                include: {
                  player1: { select: { id: true, name: true, gender: true } },
                  player2: { select: { id: true, name: true, gender: true } }
                }
              }
            }
          });

          console.log(`[Captain Portal] Lineup found for ${team.name}:`, lineupData ? `Yes (id=${lineupData.id}, entries=${lineupData.entries.length})` : 'No');
          if (!lineupData) {
            // Debug: check if there's a lineup for this team with a different bracketId
            const anyLineupForTeam = await prisma.lineup.findFirst({
              where: {
                stopId: currentMatch.round.stop.id,
                teamId: team.id
              },
              select: { id: true, bracketId: true }
            });
            console.log(`[Captain Portal] Any lineup for team ${team.name} at this stop:`, anyLineupForTeam || 'None');
          }

          // Extract 4-player lineup
          let lineup: any[] = [];
          if (lineupData && lineupData.entries.length > 0) {
            const mensDoubles = lineupData.entries.find(e => e.slot === 'MENS_DOUBLES');
            const womensDoubles = lineupData.entries.find(e => e.slot === 'WOMENS_DOUBLES');

            if (mensDoubles?.player1 && mensDoubles?.player2 &&
              womensDoubles?.player1 && womensDoubles?.player2) {
              lineup = [
                mensDoubles.player1,
                mensDoubles.player2,
                womensDoubles.player1,
                womensDoubles.player2
              ];
            }
          }

          // Get opponent lineup
          // Always find opponent team from opponentTeams (not myTeams!)
          const opponentTeam = opponentTeams.find(t => t.bracketId === bracketId);

          console.log(`[Captain Portal] Looking for opponent team for bracketId=${bracketId}:`, opponentTeam ? `Found (id=${opponentTeam.id}, name=${opponentTeam.name})` : 'Not found');

          let opponentLineup: any[] = [];
          if (hasStarted && opponentTeam) {
            const opponentLineupData = await prisma.lineup.findFirst({
              where: {
                stopId: currentMatch.round.stop.id,
                teamId: opponentTeam.id,
                bracketId: bracketId
              },
              include: {
                entries: {
                  include: {
                    player1: { select: { id: true, name: true, gender: true } },
                    player2: { select: { id: true, name: true, gender: true } }
                  }
                }
              }
            });

            console.log(`[Captain Portal] Opponent lineup found for ${opponentTeam.name}:`, opponentLineupData ? `Yes (id=${opponentLineupData.id}, entries=${opponentLineupData.entries.length})` : 'No');

            if (opponentLineupData && opponentLineupData.entries.length > 0) {
              const mensDoubles = opponentLineupData.entries.find(e => e.slot === 'MENS_DOUBLES');
              const womensDoubles = opponentLineupData.entries.find(e => e.slot === 'WOMENS_DOUBLES');

              if (mensDoubles?.player1 && mensDoubles?.player2 &&
                womensDoubles?.player1 && womensDoubles?.player2) {
                opponentLineup = [
                  mensDoubles.player1,
                  mensDoubles.player2,
                  womensDoubles.player1,
                  womensDoubles.player2
                ];
                console.log(`[Captain Portal] Opponent lineup extracted for ${opponentTeam.name}: ${opponentLineup.length} players`);
              } else {
                console.log(`[Captain Portal] Opponent lineup incomplete for ${opponentTeam.name}:`, {
                  mensDoubles: mensDoubles ? 'found' : 'missing',
                  womensDoubles: womensDoubles ? 'found' : 'missing'
                });
              }
            }
          }

          // Get games for this bracket
          // If any game has started, only show games that have been started (prevents score entry for unstarted games)
          const bracketGames = currentMatch.games.filter(g => {
            if (g.bracketId !== bracketId) return false;
            if (!hasStarted) return true; // Show all games if none started
            return g.startedAt !== null; // Only show started games after first game starts
          });

          // Map games to include lineups and perspective-adjusted scores
          const gamesWithDetails = bracketGames.map(game => {
            const gameLineup = lineup.length === 4 ? lineup : undefined;
            const gameOpponentLineup = opponentLineup.length === 4 ? opponentLineup : undefined;

            // Determine which slots this game uses based on the game slot
            let myGameLineup = undefined;
            let opponentGameLineup = undefined;

            if (gameLineup) {
              if (game.slot === 'MENS_DOUBLES') {
                myGameLineup = [gameLineup[0], gameLineup[1]];
              } else if (game.slot === 'WOMENS_DOUBLES') {
                myGameLineup = [gameLineup[2], gameLineup[3]];
              } else if (game.slot === 'MIXED_1') {
                myGameLineup = [gameLineup[0], gameLineup[2]];
              } else if (game.slot === 'MIXED_2') {
                myGameLineup = [gameLineup[1], gameLineup[3]];
              }
            }

            if (gameOpponentLineup) {
              if (game.slot === 'MENS_DOUBLES') {
                opponentGameLineup = [gameOpponentLineup[0], gameOpponentLineup[1]];
              } else if (game.slot === 'WOMENS_DOUBLES') {
                opponentGameLineup = [gameOpponentLineup[2], gameOpponentLineup[3]];
              } else if (game.slot === 'MIXED_1') {
                opponentGameLineup = [gameOpponentLineup[0], gameOpponentLineup[2]];
              } else if (game.slot === 'MIXED_2') {
                opponentGameLineup = [gameOpponentLineup[1], gameOpponentLineup[3]];
              }
            }

            // Adjust scores based on perspective
            const myScore = isTeamA ? game.teamAScore : game.teamBScore;
            const opponentScore = isTeamA ? game.teamBScore : game.teamAScore;

            return {
              id: game.id,
              slot: game.slot,
              myLineup: myGameLineup,
              opponentLineup: hasStarted ? opponentGameLineup : undefined,
              myScore,
              opponentScore,
              isComplete: game.isComplete,
              startedAt: game.startedAt,
              courtNumber: game.courtNumber
            };
          });

          const bracket = await prisma.tournamentBracket.findUnique({
            where: { id: bracketId },
            select: { id: true, name: true }
          });

          return {
            id: bracketId,
            name: bracket?.name || 'Unknown',
            team: {
              id: team.id,
              name: team.name
            },
            opponentTeam: opponentTeam ? {
              id: opponentTeam.id,
              name: opponentTeam.name
            } : null,
            roster: roster.map(r => r.player),
            lineup,
            opponentLineup: hasStarted ? opponentLineup : [],
            games: gamesWithDetails
          };
        })
      );

      return {
        tournament: {
          id: tournamentClub.tournament.id,
          name: tournamentClub.tournament.name,
          type: tournamentClub.tournament.type
        },
        club: {
          id: tournamentClub.club.id,
          name: tournamentClub.club.name
        },
        match: {
          id: currentMatch.id,
          roundId: currentMatch.roundId,
          stopId: currentMatch.round.stop.id,
          opponent: {
            id: opponent?.club?.id || opponent?.id,
            name: opponent?.club?.name || opponent?.name || 'Unknown'
          },
          hasStarted,
          location: currentMatch.round.stop.club?.name || currentMatch.round.stop.name,
          date: currentMatch.round.stop.startAt
        },
        brackets: bracketsData.filter(Boolean)
      };
      // },
      // 30 // 30 second TTL for match data
    })();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Captain portal match error:', error);
    return NextResponse.json(
      { error: 'Failed to load match data' },
      { status: 500 }
    );
  }
}
