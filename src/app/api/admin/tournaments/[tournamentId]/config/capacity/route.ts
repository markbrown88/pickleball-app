export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type CtxPromise = { params: Promise<{ tournamentId: string }> };

type CapacityPayload = {
  capacities: Array<{
    stopId: string;
    bracketId: string;
    clubId?: string | null;
    maxCapacity: number;
  }>;
};

// ---------- GET ----------
export async function GET(_req: Request, ctx: CtxPromise) {
  const { tournamentId } = await ctx.params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  const capacities = await prisma.stopBracketCapacity.findMany({
    where: { tournamentId },
    select: {
      stopId: true,
      bracketId: true,
      clubId: true,
      maxCapacity: true,
      currentCount: true,
    },
  });

  return NextResponse.json({ capacities });
}

// ---------- PUT ----------
export async function PUT(req: Request, ctx: CtxPromise) {
  const { tournamentId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as CapacityPayload;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, type: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  if (!Array.isArray(body.capacities)) {
    return NextResponse.json({ error: 'capacities must be an array' }, { status: 400 });
  }

  // Check if tournament is team-based
  const isTeamTournament = tournament.type === 'TEAM_FORMAT';

  try {
    await prisma.$transaction(async (tx) => {
      // Validate stop IDs
      const stopIds = [...new Set(body.capacities.map((c) => c.stopId))];
      if (stopIds.length > 0) {
        const stops = await tx.stop.findMany({
          where: { id: { in: stopIds }, tournamentId },
          select: { id: true },
        });
        const validStopIds = new Set(stops.map((s) => s.id));
        const invalidStopIds = stopIds.filter((id) => !validStopIds.has(id));
        if (invalidStopIds.length > 0) {
          throw new Error(`Invalid stop IDs: ${invalidStopIds.join(', ')}`);
        }
      }

      // Validate bracket IDs
      const bracketIds = [...new Set(body.capacities.map((c) => c.bracketId))];
      if (bracketIds.length > 0) {
        const brackets = await tx.tournamentBracket.findMany({
          where: { id: { in: bracketIds }, tournamentId },
          select: { id: true },
        });
        const validBracketIds = new Set(brackets.map((b) => b.id));
        const invalidBracketIds = bracketIds.filter((id) => !validBracketIds.has(id));
        if (invalidBracketIds.length > 0) {
          throw new Error(`Invalid bracket IDs: ${invalidBracketIds.join(', ')}`);
        }
      }

      // Validate club IDs (for team tournaments)
      if (isTeamTournament) {
        const clubIds = [...new Set(body.capacities.map((c) => c.clubId).filter(Boolean) as string[])];
        if (clubIds.length > 0) {
          const clubs = await tx.club.findMany({
            where: { id: { in: clubIds } },
            select: { id: true },
          });
          const validClubIds = new Set(clubs.map((c) => c.id));
          const invalidClubIds = clubIds.filter((id) => !validClubIds.has(id));
          if (invalidClubIds.length > 0) {
            throw new Error(`Invalid club IDs: ${invalidClubIds.join(', ')}`);
          }
        }
      }

      // Validate capacity values
      for (const item of body.capacities) {
        if (typeof item.maxCapacity !== 'number' || !Number.isInteger(item.maxCapacity) || item.maxCapacity <= 0) {
          throw new Error('maxCapacity must be a positive integer');
        }
      }

      // Get current counts for each combination to preserve them
      const existingCapacities = await tx.stopBracketCapacity.findMany({
        where: { tournamentId },
        select: {
          stopId: true,
          bracketId: true,
          clubId: true,
          currentCount: true,
        },
      });

      const currentCountMap = new Map<string, number>();
      existingCapacities.forEach((cap) => {
        const key = `${cap.stopId}-${cap.bracketId}-${cap.clubId || 'null'}`;
        currentCountMap.set(key, cap.currentCount);
      });

      // Delete existing capacities and recreate
      await tx.stopBracketCapacity.deleteMany({ where: { tournamentId } });

      if (body.capacities.length > 0) {
        await tx.stopBracketCapacity.createMany({
          data: body.capacities.map((item) => {
            const key = `${item.stopId}-${item.bracketId}-${item.clubId || 'null'}`;
            const currentCount = currentCountMap.get(key) ?? 0;

            return {
              tournamentId,
              stopId: item.stopId,
              bracketId: item.bracketId,
              clubId: isTeamTournament ? item.clubId ?? null : null,
              maxCapacity: item.maxCapacity,
              currentCount,
            };
          }),
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating capacity configuration:', error);
    const message = error instanceof Error ? error.message : 'Failed to update capacity configuration';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
