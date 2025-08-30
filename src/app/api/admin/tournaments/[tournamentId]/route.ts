// src/app/api/admin/tournaments/[tournamentId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { Division, TournamentType } from '@prisma/client';

function divLabel(d: Division) {
  return d === 'INTERMEDIATE' ? 'Intermediate' : 'Advanced';
}

// Accept either enum values or nice labels.
const TYPE_MAP: Record<string, TournamentType> = {
  'TEAM_FORMAT': 'TEAM_FORMAT',
  'Team Format': 'TEAM_FORMAT',
  'SINGLE_ELIMINATION': 'SINGLE_ELIMINATION',
  'Single Elimination': 'SINGLE_ELIMINATION',
  'DOUBLE_ELIMINATION': 'DOUBLE_ELIMINATION',
  'Double Elimination': 'DOUBLE_ELIMINATION',
  'ROUND_ROBIN': 'ROUND_ROBIN',
  'Round Robin': 'ROUND_ROBIN',
  'POOL_PLAY': 'POOL_PLAY',
  'Pool Play': 'POOL_PLAY',
  'LADDER_TOURNAMENT': 'LADDER_TOURNAMENT',
  'Ladder Tournament': 'LADDER_TOURNAMENT',
} as const;

/** DELETE /api/admin/tournaments/:tournamentId */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ tournamentId: string }> }
) {
  const prisma = getPrisma();
  const { tournamentId } = await ctx.params;

  const exists = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // ON DELETE CASCADE in schema will clear dependent rows (teams, stops, links, etc.)
  await prisma.tournament.delete({ where: { id: tournamentId } });
  return new NextResponse(null, { status: 204 });
}

/**
 * PUT /api/admin/tournaments/:tournamentId
 * Body: {
 *   name: string,
 *   type?: TournamentType | "Team Format" | "Single Elimination" | ...,
 *   participants?: [{ clubId, intermediateCaptainId, advancedCaptainId }],
 *   syncParticipants?: boolean   // if true, remove clubs/teams no longer present
 * }
 *
 * Behavior:
 * - Updates name (and type if provided)
 * - Creates/updates INTERMEDIATE & ADVANCED teams per club with captains
 * - Ensures captain is on roster (TeamPlayer)
 * - Syncs TournamentClub links (create missing; delete removed when syncParticipants=true)
 * - If syncParticipants=true, deletes teams whose club is no longer in participants
 */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ tournamentId: string }> }
) {
  const prisma = getPrisma();
  const { tournamentId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const typeInput = body.type as (TournamentType | string | undefined);
  const type: TournamentType | undefined =
    typeInput && TYPE_MAP[String(typeInput)]
      ? TYPE_MAP[String(typeInput)]
      : undefined;

  const participants: Array<{
    clubId: string;
    intermediateCaptainId: string;
    advancedCaptainId: string;
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
    await prisma.$transaction(async (tx) => {
      // Update tournament basic fields
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { name, ...(type ? { type } : {}) },
      });

      // ---- Sync TournamentClub links (explicit participants) ----
      const keepClubIds = Array.from(
        new Set(participants.map(p => String(p.clubId)).filter(Boolean))
      );

      if (keepClubIds.length) {
        // Validate clubs exist for nice errors
        const clubs = await tx.club.findMany({
          where: { id: { in: keepClubIds } },
          select: { id: true },
        });
        const found = new Set(clubs.map(c => c.id));
        const missing = keepClubIds.filter(id => !found.has(id));
        if (missing.length) {
          throw new Error(`Club(s) not found: ${missing.join(', ')}`);
        }

        // Create missing TournamentClub links
        await tx.tournamentClub.createMany({
          data: keepClubIds.map(cid => ({ tournamentId, clubId: cid })),
          skipDuplicates: true,
        });

        if (syncParticipants) {
          // Remove TournamentClub links that are no longer selected
          await tx.tournamentClub.deleteMany({
            where: {
              tournamentId,
              clubId: { notIn: keepClubIds },
            },
          });
        }
      } else if (syncParticipants) {
        // If no participants provided & sync requested, clear all links
        await tx.tournamentClub.deleteMany({ where: { tournamentId } });
      }

      // ---- Optionally remove teams for clubs that are no longer participants ----
      if (syncParticipants) {
        const currentTeams = await tx.team.findMany({
          where: { tournamentId },
          select: { id: true, clubId: true },
        });
        const deleteTeamIds = currentTeams
          .filter(ct => ct.clubId && !keepClubIds.includes(ct.clubId))
          .map(ct => ct.id);

        if (deleteTeamIds.length) {
          await tx.team.deleteMany({ where: { id: { in: deleteTeamIds } } });
        }
      }

      // ---- Upsert teams (per club, per division) and captains ----
      for (const p of participants) {
        const clubId = String(p.clubId || '').trim();
        if (!clubId) throw new Error('Participant clubId is required');

        const iCap = String(p.intermediateCaptainId || '').trim();
        const aCap = String(p.advancedCaptainId || '').trim();
        if (!iCap || !aCap) throw new Error('Both division captains are required');

        const club = await tx.club.findUnique({ where: { id: clubId }, select: { name: true } });
        const clubName = club?.name ?? 'Club';

        for (const division of ['INTERMEDIATE', 'ADVANCED'] as Division[]) {
          const captainId = division === 'INTERMEDIATE' ? iCap : aCap;

          // Captain already on some team in this tournament?
          const otherTeam = await tx.teamPlayer.findFirst({
            where: { tournamentId, playerId: captainId },
            select: { teamId: true },
          });

          let team = await tx.team.findFirst({
            where: { tournamentId, clubId, division },
            select: { id: true, captainId: true },
          });

          // If captain is on another team (not this one), block early
          if (otherTeam && (!team || otherTeam.teamId !== team.id)) {
            throw new Error(
              `Selected captain is already on another team in this tournament (division: ${divLabel(division)}).`
            );
          }

          if (!team) {
            const defaultName = `${clubName} ${divLabel(division)}`;
            team = await tx.team.create({
              data: {
                name: defaultName,
                division,
                tournament: { connect: { id: tournamentId } },
                club: { connect: { id: clubId } },
                captain: { connect: { id: captainId } },
              },
              select: { id: true, captainId: true },
            });
          } else if (team.captainId !== captainId) {
            await tx.team.update({ where: { id: team.id }, data: { captainId } });
          }

          // Ensure captain is on roster for this team/tournament
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
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to update tournament' }, { status: 400 });
  }
}
