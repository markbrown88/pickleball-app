import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/player/registrations
 * Get current user's tournament registrations
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's player profile
    const player = await prisma.player.findUnique({
      where: { clerkUserId: userId }
    });

    if (!player) {
      return NextResponse.json(
        { error: 'Player profile not found' },
        { status: 404 }
      );
    }

    // Get player's team registrations
    const registrations = await prisma.teamPlayer.findMany({
      where: { playerId: player.id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            bracket: {
              select: {
                name: true
              }
            }
          }
        },
        tournament: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    const formattedRegistrations = registrations.map(reg => ({
      tournamentId: reg.tournamentId,
      tournamentName: reg.tournament.name,
      tournamentType: reg.tournament.type,
      teamId: reg.team.id,
      teamName: reg.team.name,
      bracket: reg.team.bracket?.name || 'Unknown'
    }));

    return NextResponse.json(formattedRegistrations);
  } catch (error) {
    console.error('Error fetching player registrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registrations' },
      { status: 500 }
    );
  }
}

