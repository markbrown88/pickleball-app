import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';

/**
 * GET /api/player/tournaments
 * Get tournaments where the current player has participated
 */
export async function GET(req: NextRequest) {
  try {
    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    const effectivePlayer = await getEffectivePlayer(actAsPlayerId);

    // Find tournaments where the player has participated
    const playerTournaments = await prisma.teamPlayer.findMany({
      where: {
        playerId: effectivePlayer.targetPlayerId
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            createdAt: true
          }
        },
        team: {
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
        }
      },
      orderBy: {
        tournament: {
          createdAt: 'desc'
        }
      }
    });

    // Transform the data for the frontend
    const tournaments = playerTournaments.map(tp => ({
      id: tp.tournament.id,
      name: tp.tournament.name,
      type: tp.tournament.type,
      date: tp.tournament.createdAt,
      team: {
        id: tp.team.id,
        name: tp.team.name,
        club: tp.team.club
      }
    }));

    return NextResponse.json({ tournaments });
  } catch (error) {
    console.error('Error fetching player tournaments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player tournaments' },
      { status: 500 }
    );
  }
}



