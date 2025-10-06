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

    // Find games where the player has participated
    // This is complex because we need to look through team lineups in games
    const games = await prisma.game.findMany({
      where: {
        OR: [
          {
            teamALineup: {
              path: ['$'],
              array_contains: effectivePlayer.targetPlayerId
            }
          },
          {
            teamBLineup: {
              path: ['$'],
              array_contains: effectivePlayer.targetPlayerId
            }
          }
        ]
      },
      include: {
        match: {
          include: {
            teamA: {
              select: {
                id: true,
                name: true,
                club: {
                  select: {
                    id: true,
                    name: true,
                    city: true,
                    region: true
                  }
                }
              }
            },
            teamB: {
              select: {
                id: true,
                name: true,
                club: {
                  select: {
                    id: true,
                    name: true,
                    city: true,
                    region: true
                  }
                }
              }
            },
            round: {
              include: {
                stop: {
                  select: {
                    id: true,
                    name: true,
                    startAt: true,
                    endAt: true,
                    club: {
                      select: {
                        id: true,
                        name: true,
                        city: true,
                        region: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data for the frontend
    const playerGames = games.map(game => {
      const isTeamA = game.teamALineup && Array.isArray(game.teamALineup) && 
        (game.teamALineup as string[]).includes(effectivePlayer.targetPlayerId);
      
      const playerTeam = isTeamA ? game.match.teamA : game.match.teamB;
      const opponentTeam = isTeamA ? game.match.teamB : game.match.teamA;
      
      return {
        id: game.id,
        slot: game.slot,
        teamAScore: game.teamAScore,
        teamBScore: game.teamBScore,
        isComplete: game.isComplete,
        startedAt: game.startedAt,
        endedAt: game.endedAt,
        createdAt: game.createdAt,
        playerTeam: {
          id: playerTeam?.id,
          name: playerTeam?.name,
          club: playerTeam?.club
        },
        opponentTeam: {
          id: opponentTeam?.id,
          name: opponentTeam?.name,
          club: opponentTeam?.club
        },
        stop: {
          id: game.match.round.stop.id,
          name: game.match.round.stop.name,
          startAt: game.match.round.stop.startAt,
          endAt: game.match.round.stop.endAt,
          club: game.match.round.stop.club
        }
      };
    });

    return NextResponse.json({ games: playerGames });
  } catch (error) {
    console.error('Error fetching player games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player games' },
      { status: 500 }
    );
  }
}
