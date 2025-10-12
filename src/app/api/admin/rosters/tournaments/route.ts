import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { prisma } from '@/lib/prisma';

type RosterTournament = {
  id: string;
  name: string;
  role: 'APP_ADMIN' | 'TOURNAMENT_ADMIN' | 'CAPTAIN';
};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check for act-as-player-id cookie
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const actAsPlayerId = cookieStore.get('act-as-player-id')?.value;

    let player;
    if (actAsPlayerId) {
      // Acting as another player - fetch that player's record
      player = await prisma.player.findUnique({
        where: { id: actAsPlayerId },
        select: {
          id: true,
          isAppAdmin: true,
          tournamentAdminLinks: { select: { tournamentId: true } },
          TournamentCaptain: { select: { tournamentId: true } },
        },
      });
    } else {
      // Normal operation - use authenticated user
      player = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: {
          id: true,
          isAppAdmin: true,
          tournamentAdminLinks: { select: { tournamentId: true } },
          TournamentCaptain: { select: { tournamentId: true } },
        },
      });
    }

    if (!player) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (player.isAppAdmin) {
      const tournaments = await prisma.tournament.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

      const response: RosterTournament[] = tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        role: 'APP_ADMIN',
      }));

      return NextResponse.json(response);
    }

    const adminTournamentIds = new Set(
      player.tournamentAdminLinks.map((link) => link.tournamentId)
    );
    const captainTournamentIds = new Set(
      player.TournamentCaptain.map((link) => link.tournamentId)
    );

    const combinedIds = new Set<string>([...adminTournamentIds, ...captainTournamentIds]);

    if (!combinedIds.size) {
      return NextResponse.json([] satisfies RosterTournament[]);
    }

    const tournaments = await prisma.tournament.findMany({
      where: { id: { in: Array.from(combinedIds) } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const response: RosterTournament[] = tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      role: adminTournamentIds.has(t.id) ? 'TOURNAMENT_ADMIN' : 'CAPTAIN',
    }));

    return NextResponse.json(response);
  } catch (e: any) {
    const message = e?.message ?? 'Failed to load tournaments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

