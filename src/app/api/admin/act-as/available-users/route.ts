import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is app admin
    const currentPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { isAppAdmin: true },
    });

    if (!currentPlayer?.isAppAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all players for Act As dropdown
    const players = await prisma.player.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isAppAdmin: true,
        TournamentCaptain: { select: { tournamentId: true }, take: 1 },
        tournamentAdminLinks: { select: { tournamentId: true }, take: 1 },
        TournamentEventManager: { select: { tournamentId: true }, take: 1 },
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    // Transform players to the expected format
    const availableUsers = players.map(player => {
      const hasTournamentAdminRole =
        player.tournamentAdminLinks.length > 0 || player.TournamentEventManager.length > 0;
      const hasCaptainRole = player.TournamentCaptain.length > 0;

      let role: 'app-admin' | 'tournament-admin' | 'captain' | 'player';
      if (player.isAppAdmin) role = 'app-admin';
      else if (hasTournamentAdminRole) role = 'tournament-admin';
      else if (hasCaptainRole) role = 'captain';
      else role = 'player';

      return {
        id: player.id,
        name: `${player.firstName} ${player.lastName}`.trim(),
        role,
        email: player.email,
      };
    });

    return NextResponse.json({ users: availableUsers });
  } catch (error) {
    console.error('Error fetching available users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available users' },
      { status: 500 }
    );
  }
}

