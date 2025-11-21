export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    // Use singleton prisma instance
    const { playerId } = await params;

    // Support Act As functionality - if acting as, use that player ID instead
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    let effectivePlayerId = playerId;
    
    if (actAsPlayerId) {
      try {
        const { userId } = await auth();
        if (userId) {
          const effectivePlayer = await getEffectivePlayer(actAsPlayerId);
          // If we're acting as someone, use their ID instead of the URL param
          effectivePlayerId = effectivePlayer.targetPlayerId;
        }
      } catch (actAsError) {
        // If Act As fails, continue with the playerId from URL
        console.log('Overview API: Act As error, using URL playerId:', actAsError);
      }
    }

    // Basic profile + captain teams
    const player = await prisma.player.findUnique({
      where: { id: effectivePlayerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        gender: true,
        clubId: true,
        city: true,
        region: true,
        country: true,
        phone: true,
        email: true,
        duprDoubles: true,
        duprSingles: true,
        birthdayYear: true,
        birthdayMonth: true,
        birthdayDay: true,
        teamsAsCaptain: { select: { id: true, name: true, tournamentId: true } },
        club: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true
          }
        },
      },
    });
    if (!player) return NextResponse.json({ error: 'player not found' }, { status: 404 });

    // All rostered stops for this player
    const rosterLinks = await prisma.stopTeamPlayer.findMany({
      where: { playerId: effectivePlayerId },
      include: {
        stop: {
          include: {
            tournament: { select: { id: true, name: true } },
          },
        },
        team: {
          include: {
            club: true,
            tournament: { select: { id: true, name: true } },
            bracket: { select: { id: true, name: true } },
            captain: { select: { id: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    // Filter to only ongoing tournaments (where stop hasn't ended yet or no end date)
    const now = new Date();
    const ongoingRosterLinks = rosterLinks.filter(link => {
      const stopEndAt = link.stop.endAt ? new Date(link.stop.endAt) : null;
      return !stopEndAt || stopEndAt >= now;
    });

    // Flatten rows for UI table
    const assignments = ongoingRosterLinks.map(link => ({
      tournamentId: link.team.tournament?.id ?? link.stop.tournament.id,
      tournamentName: link.team.tournament?.name ?? link.stop.tournament.name,
      stopId: link.stopId,
      stopName: link.stop.name,
      stopStartAt: link.stop.startAt ? link.stop.startAt.toISOString() : null,
      stopEndAt: link.stop.endAt ? link.stop.endAt.toISOString() : null,
      teamId: link.teamId,
      teamName: link.team.name,
      teamClubName: link.team.club?.name ?? null,
      bracketId: link.team.bracket?.id ?? null,
      bracketName: link.team.bracket?.name ?? null,
      isCaptain: link.team.captain?.id === effectivePlayerId,
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
        dupr: player.duprDoubles ?? null, // Map duprDoubles to dupr for backward compatibility
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
