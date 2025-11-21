import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';

/**
 * GET /api/player/games
 * Get games where the current player has participated
 */
export async function GET(req: NextRequest) {
  try {
    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    const effectivePlayer = await getEffectivePlayer(actAsPlayerId);

    // Find all lineup entries where player participated
    const lineupEntries = await prisma.lineupEntry.findMany({
      where: {
        OR: [
          { player1Id: effectivePlayer.targetPlayerId },
          { player2Id: effectivePlayer.targetPlayerId }
        ]
      },
      include: {
        lineup: {
          include: {
            team: {
              include: {
                club: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            round: {
              include: {
                stop: {
                  include: {
                    tournament: {
                      select: {
                        id: true,
                        name: true,
                        type: true
                      }
                    }
                  }
                },
                matches: {
                  include: {
                    teamA: {
                      include: {
                        club: {
                          select: {
                            id: true,
                            name: true
                          }
                        }
                      }
                    },
                    teamB: {
                      include: {
                        club: {
                          select: {
                            id: true,
                            name: true
                          }
                        }
                      }
                    },
                    games: true
                  }
                }
              }
            }
          }
        },
        player1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            duprDoubles: true,
            duprSingles: true
          }
        },
        player2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            duprDoubles: true,
            duprSingles: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Process lineup entries to extract games
    const gamesData: any[] = [];
    const seenGames = new Set<string>();

    for (const entry of lineupEntries) {
      const { lineup, slot, player1, player2 } = entry;
      const { team: playerTeam, round } = lineup;

      // Determine partner
      const partner = player1.id === effectivePlayer.targetPlayerId ? player2 : player1;

      // Find matches where this team participated
      for (const match of round.matches) {
        if (match.teamAId !== playerTeam.id && match.teamBId !== playerTeam.id) {
          continue; // Skip matches not involving this team
        }

        // Determine opponent team
        const opponentTeam = match.teamAId === playerTeam.id ? match.teamB : match.teamA;
        const isTeamA = match.teamAId === playerTeam.id;

        // Find games in this match with matching slot
        const matchGames = match.games.filter(g => g.slot === slot);

        for (const game of matchGames) {
          // Avoid duplicate games
          if (seenGames.has(game.id)) continue;
          seenGames.add(game.id);

          // Skip games that haven't started yet (no startedAt date)
          // Only show games that have actually started or are complete
          if (!game.startedAt && !game.isComplete) {
            continue;
          }

          // Skip games from forfeited matches (game scores are invalid)
          const isForfeit = match.forfeitTeam !== null;

          gamesData.push({
            id: game.id,
            matchId: match.id,
            slot: game.slot,
            teamAScore: game.teamAScore,
            teamBScore: game.teamBScore,
            isComplete: game.isComplete,
            isForfeit,
            forfeitTeam: match.forfeitTeam,
            startedAt: game.startedAt,
            endedAt: game.endedAt,
            createdAt: game.createdAt,
            playerTeam: {
              id: playerTeam.id,
              name: playerTeam.name,
              club: playerTeam.club
            },
            opponentTeam: opponentTeam ? {
              id: opponentTeam.id,
              name: opponentTeam.name,
              club: opponentTeam.club
            } : null,
            partner: {
              id: partner.id,
              firstName: partner.firstName,
              lastName: partner.lastName,
              name: partner.name,
              // GameSlot enum only includes doubles types, so always use duprDoubles
              dupr: partner.duprDoubles ?? null
            },
            isTeamA,
            stop: {
              id: round.stop.id,
              name: round.stop.name
            },
            tournament: round.stop.tournament
          });
        }
      }
    }

    // Sort by game date (endedAt > startedAt > createdAt) - most recent first
    gamesData.sort((a, b) => {
      const dateA = a.endedAt ? new Date(a.endedAt).getTime() 
        : a.startedAt ? new Date(a.startedAt).getTime() 
        : new Date(a.createdAt).getTime();
      const dateB = b.endedAt ? new Date(b.endedAt).getTime() 
        : b.startedAt ? new Date(b.startedAt).getTime() 
        : new Date(b.createdAt).getTime();
      return dateB - dateA; // Descending order (newest first)
    });

    return NextResponse.json({ games: gamesData });
  } catch (error) {
    console.error('Error fetching player games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player games' },
      { status: 500 }
    );
  }
}
