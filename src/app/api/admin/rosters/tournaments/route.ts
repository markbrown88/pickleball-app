import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

type RosterTournament = {
  id: string;
  name: string;
  role: 'APP_ADMIN' | 'TOURNAMENT_ADMIN' | 'CAPTAIN';
};

export async function GET() {
  try {
    // 1. Centralized Auth & Act As Support
    // No specific level required here as Captains can also access this list
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const { player: effectivePlayer } = authResult;

    // Fetch full details needed for this route (TournamentCaptain)
    const player = await prisma.player.findUnique({
      where: { id: effectivePlayer.id },
      select: {
        id: true,
        isAppAdmin: true,
        tournamentAdminLinks: { select: { tournamentId: true } },
        TournamentCaptain: { select: { tournamentId: true } },
      },
    });

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

