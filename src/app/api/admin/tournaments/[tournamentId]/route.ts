// src/app/api/admin/tournaments/[tournamentId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { Division, TournamentType } from '@prisma/client';

function divLabel(d: Division) {
  return d === 'INTERMEDIATE' ? 'Intermediate' : 'Advanced';
}

const TYPE_MAP: Record<string, TournamentType> = {
  TEAM_FORMAT: 'TEAM_FORMAT',
  'Team Format': 'TEAM_FORMAT',
  SINGLE_ELIMINATION: 'SINGLE_ELIMINATION',
  'Single Elimination': 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION: 'DOUBLE_ELIMINATION',
  'Double Elimination': 'DOUBLE_ELIMINATION',
  ROUND_ROBIN: 'ROUND_ROBIN',
  'Round Robin': 'ROUND_ROBIN',
  POOL_PLAY: 'POOL_PLAY',
  'Pool Play': 'POOL_PLAY',
  LADDER_TOURNAMENT: 'LADDER_TOURNAMENT',
  'Ladder Tournament': 'LADDER_TOURNAMENT',
} as const;

/** DELETE /api/admin/tournaments/:tournamentId */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ tournamentId: string }> }
) {
  const prisma = getPrisma();
  const { tournamentId } = await ctx.params;

  const exists = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.tournament.delete({ where: { id: tournamentId } });
  return new NextResponse(null, { status: 204 });
}

/**
 * PUT /api/admin/tournaments/:tournamentId
 * Body:
 * {
 *   name: string,
 *   type?: TournamentType | "Team Format" | ...,
 *   participants?: [{ clubId, intermediateCaptainId?, advancedCaptainId? }],
 *   syncParticipants?: boolean
 * }
 *
 * Reconciliation:
 * - Ensures a DEFAULT bracket (TournamentBracket) if none.
 * - Ensures teams for each (club × bracket).
 * - Ensures StopTeam links for every Stop × Team.
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ tournamentId: string }> }
) {
  const prisma = getPrisma();
  const { tournamentId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const typeInput = body.type as (TournamentType | string | undefined);
  const type: TournamentType | undefined =
    typeInput && TYPE_MAP[String(typeInput)] ? TYPE_MAP[String(typeInput)] : undefined;

  const participants: Array<{
    clubId: string;
    intermediateCaptainId?: string;
    advancedCaptainId?: string;
  }> = Array.isArray(body.participants) ? body.participants : [];

  const syncParticipants = !!body.syncParticipants;

  if (!name) {
    return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
  }

  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Basic update
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { name, ...(type ? { type } : {}) },
      });

      // 2) TournamentClub sync from participants (if provided)
      let keepClubIds: string[] = [];
      if (participants.length) {
        keepClubIds = Array.from(new Set(participants.map((p) => String(p.clubId)).filter(Boolean)));

        if (keepClubIds.length) {
          const clubs = await tx.club.findMany({
            where: { id: { in: keepClubIds } },
            select: { id: true },
          });
          const found = new Set(clubs.map((c) => c.id));
          const missing = keepClubIds.filter((id) => !found.has(id));
          if (missing.length) throw new Error(`Club(s) not found: ${missing.join(', ')}`);

          await tx.tournamentClub.createMany({
            data: keepClubIds.map((cid) => ({ tournamentId, clubId: cid })),
            skipDuplicates: true,
          });

          if (syncParticipants) {
            await tx.tournamentClub.deleteMany({
              where: { tournamentId, clubId: { notIn: keepClubIds } },
            });
          }
        } else if (syncParticipants) {
          await tx.tournamentClub.deleteMany({ where: { tournamentId } });
        }
      }

      // 3) Legacy division-based team + (optional) captain support
      if (participants.length) {
        for (const p of participants) {
          const clubId = String(p.clubId || '').trim();
          if (!clubId) throw new Error('Participant clubId is required');

          const iCap = p.intermediateCaptainId ? String(p.intermediateCaptainId).trim() : '';
          const aCap = p.advancedCaptainId ? String(p.advancedCaptainId).trim() : '';

          const club = await tx.club.findUnique({ where: { id: clubId }, select: { name: true } });
          const clubName = club?.name ?? 'Club';

          for (const division of ['INTERMEDIATE', 'ADVANCED'] as Division[]) {
            const captainId = division === 'INTERMEDIATE' ? iCap : aCap;

            let team = await tx.team.findFirst({
              where: { tournamentId, clubId, division },
              select: { id: true, captainId: true, name: true },
            });

            if (!team) {
              const defaultName = `${clubName} ${divLabel(division)}`;
              team = await tx.team.create({
                data: {
                  name: defaultName,
                  division,
                  tournament: { connect: { id: tournamentId } },
                  club: { connect: { id: clubId } },
                  ...(captainId ? { captain: { connect: { id: captainId } } } : {}),
                },
                select: { id: true, captainId: true, name: true },
              });
            } else if (captainId && team.captainId !== captainId) {
              await tx.team.update({ where: { id: team.id }, data: { captainId } });
            }

            if (captainId) {
              const existing = await tx.teamPlayer.findFirst({
                where: { teamId: team.id, playerId: captainId },
                select: { teamId: true },
              });
              if (!existing) {
                await tx.teamPlayer.create({
                  data: {
                    team: { connect: { id: team.id } },
                    player: { connect: { id: captainId } },
                    tournament: { connect: { id: tournamentId } },
                  },
                });
              }
            }
          }
        }
      }

      // 4) Reconciliation: brackets + StopTeams
      const full = await tx.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          clubs: { include: { club: true } },    // TournamentClub[]
          brackets: { orderBy: { idx: 'asc' } }, // TournamentBracket[]
          stops: true,                            // Stop[]
        },
      });
      if (!full) throw new Error('Tournament not found during reconciliation');

      // Ensure DEFAULT bracket if none exist
      let brackets = full.brackets;
      if (!brackets || brackets.length === 0) {
        const def = await tx.tournamentBracket.upsert({
          where: { tournamentId_name: { tournamentId, name: 'DEFAULT' } },
          update: {},
          create: { tournamentId, name: 'DEFAULT', idx: 0 },
        });
        brackets = [def];
      }

      // Ensure teams per (club × bracket) and StopTeam links
      for (const tc of full.clubs) {
        const clubId = tc.clubId;
        for (const br of brackets) {
          let team = await tx.team.findFirst({
            where: { tournamentId, clubId, bracketId: br.id },
            include: { club: true, bracket: true },
          });

          if (!team) {
            const label =
              br.name === 'DEFAULT' ? (tc.club?.name ?? 'Team') : `${tc.club?.name ?? 'Team'} ${br.name}`;
            team = await tx.team.create({
              data: {
                name: label,
                tournamentId,
                clubId,
                bracketId: br.id,
              },
              include: { club: true, bracket: true },
            });
          }

          for (const s of full.stops) {
            await tx.stopTeam.upsert({
              where: { stopId_teamId: { stopId: s.id, teamId: team.id } },
              update: {},
              create: { stopId: s.id, teamId: team.id },
            });
          }
        }
      }

      return { ok: true };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to update tournament' }, { status: 400 });
  }
}
