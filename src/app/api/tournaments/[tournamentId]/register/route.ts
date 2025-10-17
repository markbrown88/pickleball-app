import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/tournaments/[tournamentId]/register
 * Register the current user for a tournament
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { tournamentId } = await params;
    
    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 });
    }

    // Get user's player profile
    const player = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      include: {
        club: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!player) {
      return NextResponse.json(
        { error: 'Player profile not found. Please complete your profile first.' },
        { status: 404 }
      );
    }

    // Check if tournament exists and get its details
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        clubs: {
          include: {
            club: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        brackets: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if player's club is participating in this tournament
    const clubParticipating = tournament.clubs.some(
      tc => tc.clubId === player.clubId
    );

    if (!clubParticipating) {
      return NextResponse.json(
        { 
          error: `Your club (${player.club.name}) is not participating in this tournament. Please contact the tournament administrator.` 
        },
        { status: 403 }
      );
    }

    // Check if player is already registered for this tournament
    const existingRegistration = await prisma.teamPlayer.findFirst({
      where: {
        playerId: player.id,
        tournamentId: tournamentId
      },
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
        }
      }
    });

    if (existingRegistration) {
      return NextResponse.json({
        message: 'Already registered',
        registration: {
          teamId: existingRegistration.team.id,
          teamName: existingRegistration.team.name,
          bracket: existingRegistration.team.bracket?.name || 'Unknown'
        }
      });
    }

    // Get request body to determine bracket preference
    const body = await req.json().catch(() => ({}));
    const { bracketId, preferredBracket } = body;

    // If no bracket specified, try to find an appropriate one
    let targetBracketId = bracketId;
    
    if (!targetBracketId && preferredBracket) {
      const bracket = tournament.brackets.find(b => 
        b.name.toLowerCase() === preferredBracket.toLowerCase()
      );
      if (bracket) {
        targetBracketId = bracket.id;
      }
    }

    // If still no bracket, use the first available one
    if (!targetBracketId && tournament.brackets.length > 0) {
      targetBracketId = tournament.brackets[0].id;
    }

    if (!targetBracketId) {
      return NextResponse.json(
        { error: 'No brackets available for this tournament' },
        { status: 400 }
      );
    }

    // Find or create a team for this player's club and bracket
    let team = await prisma.team.findFirst({
      where: {
        tournamentId: tournamentId,
        clubId: player.clubId,
        bracketId: targetBracketId
      },
      include: {
        bracket: {
          select: {
            name: true
          }
        }
      }
    });

    if (!team) {
      // Create a new team for this club and bracket
      const bracket = tournament.brackets.find(b => b.id === targetBracketId);
      team = await prisma.team.create({
        data: {
          name: `${player.club.name} ${bracket?.name || 'Team'}`,
          tournamentId: tournamentId,
          clubId: player.clubId,
          bracketId: targetBracketId,
          division: null
        },
        include: {
          bracket: {
            select: {
              name: true
            }
          }
        }
      });
    }

    // Add player to the team
    await prisma.teamPlayer.create({
      data: {
        teamId: team.id,
        playerId: player.id,
        tournamentId: tournamentId
      }
    });

    return NextResponse.json({
      message: 'Successfully registered for tournament',
      registration: {
        teamId: team.id,
        teamName: team.name,
        bracket: team.bracket?.name || 'Unknown',
        tournamentName: tournament.name
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error registering for tournament:', error);
    return NextResponse.json(
      { error: 'Failed to register for tournament' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tournaments/[tournamentId]/register
 * Get registration status for the current user
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { tournamentId } = await params;
    
    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 });
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

    // Check registration status
    const registration = await prisma.teamPlayer.findFirst({
      where: {
        playerId: player.id,
        tournamentId: tournamentId
      },
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
        }
      }
    });

    if (!registration) {
      return NextResponse.json({
        registered: false,
        message: 'Not registered for this tournament'
      });
    }

    return NextResponse.json({
      registered: true,
      registration: {
        teamId: registration.team.id,
        teamName: registration.team.name,
        bracket: registration.team.bracket?.name || 'Unknown'
      }
    });

  } catch (error) {
    console.error('Error checking registration status:', error);
    return NextResponse.json(
      { error: 'Failed to check registration status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tournaments/[tournamentId]/register
 * Unregister the current user from a tournament
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { tournamentId } = await params;
    
    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 });
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

    // Find and delete registration
    const registration = await prisma.teamPlayer.findFirst({
      where: {
        playerId: player.id,
        tournamentId: tournamentId
      }
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Not registered for this tournament' },
        { status: 404 }
      );
    }

    await prisma.teamPlayer.delete({
      where: {
        teamId_playerId: {
          teamId: registration.teamId,
          playerId: player.id
        }
      }
    });

    return NextResponse.json({
      message: 'Successfully unregistered from tournament'
    });

  } catch (error) {
    console.error('Error unregistering from tournament:', error);
    return NextResponse.json(
      { error: 'Failed to unregister from tournament' },
      { status: 500 }
    );
  }
}

