export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

function computeAge(y?: number | null, m?: number | null, d?: number | null): number | null {
  if (!y || !m || !d) return null;
  try {
    const today = new Date();
    let age = today.getFullYear() - y;
    const mm = (m ?? 1) - 1;
    if (today.getMonth() < mm || (today.getMonth() === mm && today.getDate() < (d ?? 1))) age -= 1;
    return age;
  } catch { return null; }
}

export async function GET(_req: Request, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const prisma = getPrisma();
    const { playerId } = await params;

    // Basic profile + captain teams
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        club: true,
        teamsAsCaptain: { select: { id: true, name: true, tournamentId: true } },
      },
    });
    if (!player) return NextResponse.json({ error: 'player not found' }, { status: 404 });

    // All rostered stops for this player
    const rosterLinks = await prisma.stopTeamPlayer.findMany({
      where: { playerId },
      include: {
        stop: {
          include: {
            tournament: { select: { id: true, name: true } },
            // club? (location club). If you store location in Stop.clubId, include it:
            // club: true,
          },
        },
        team: {
          include: {
            club: true,
            tournament: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    // Flatten rows for UI table
    const assignments = rosterLinks.map(link => ({
      tournamentId: link.team.tournament?.id ?? link.stop.tournament.id,
      tournamentName: link.team.tournament?.name ?? link.stop.tournament.name,
      stopId: link.stopId,
      stopName: link.stop.name,
      stopStartAt: (link.stop as any).startAt ?? null,
      stopEndAt: (link.stop as any).endAt ?? null,
      teamId: link.teamId,
      teamName: link.team.name,
      teamClubName: link.team.club?.name ?? null,
    }));

    const age = computeAge(player.birthdayYear as any, player.birthdayMonth as any, player.birthdayDay as any);

    return NextResponse.json({
      player: {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        name: player.name,
        gender: player.gender,
        club: player.club,
        clubId: player.clubId,
        city: player.city,
        region: player.region,
        country: player.country,
        phone: player.phone,
        email: player.email,
        dupr: player.dupr,
        birthdayYear: player.birthdayYear,
        birthdayMonth: player.birthdayMonth,
        birthdayDay: player.birthdayDay,
        age,
      },
      captainTeamIds: player.teamsAsCaptain.reduce((acc, team) => ({ ...acc, [team.id]: true }), {}),
      assignments,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
