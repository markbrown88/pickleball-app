// src/app/api/admin/teams/[teamId]/members/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Id = string;

function toPlayerLite(p: any) {
  return {
    id: p.id as string,
    firstName: p.firstName ?? null,
    lastName: p.lastName ?? null,
    name: p.name ?? null,
    gender: p.gender,
    dupr: p.dupr ?? null,
    age: p.age ?? null,
    clubId: p.clubId ?? null,
  };
}

/**
 * GET /api/admin/teams/:teamId/members
 * Returns team info + current members (TeamPlayer → Player)
 */
export async function GET(
  _req: Request,
  ctx: { params: { teamId: string } } | { params: Promise<{ teamId: string }> }
) {
  const raw: any = (ctx as any).params;
  const { teamId } = typeof raw?.then === 'function' ? await raw : raw;

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        club: { select: { id: true, name: true, city: true } },
        bracket: { select: { id: true, name: true, idx: true } }, // ← renamed from "level"
        captain: { select: { id: true, firstName: true, lastName: true, name: true } }, // relation "TeamCaptain"
        tournament: { select: { id: true, name: true, maxTeamSize: true } },
        playerLinks: {
          include: { player: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const members = team.playerLinks.map((l) => toPlayerLite(l.player));

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        club: team.club ? { id: team.club.id, name: team.club.name, city: team.club.city ?? null } : null,
        bracket: team.bracket ? { id: team.bracket.id, name: team.bracket.name, idx: team.bracket.idx } : null,
        captain: team.captain
          ? { id: team.captain.id, firstName: team.captain.firstName, lastName: team.captain.lastName, name: team.captain.name }
          : null,
        tournament: team.tournament
          ? { id: team.tournament.id, name: team.tournament.name, maxTeamSize: team.tournament.maxTeamSize ?? null }
          : null,
      },
      members,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/*
Notes on fixes:
- Replaced old `level/levelId` references with `bracket/bracketId` to match the Prisma schema.
- Switched to `include` for relations (club, bracket, captain, playerLinks, tournament) to avoid
  the Prisma error “Please either choose `select` or `include`.”
- Accesses like `team.club`, `team.bracket`, `team.captain`, and `team.playerLinks` now type-check.
*/
