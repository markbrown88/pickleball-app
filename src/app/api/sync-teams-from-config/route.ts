export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Heuristic: map a free-form level name to a legacy Division (only used to avoid the unique constraint)
function inferDivision(levelName?: string | null): 'INTERMEDIATE' | 'ADVANCED' | null {
  if (!levelName) return null;
  const s = levelName.trim().toLowerCase();
  if (s.startsWith('inter')) return 'INTERMEDIATE';
  if (s.startsWith('adv')) return 'ADVANCED';
  return null;
}

export async function GET() {
  // Use singleton prisma instance

  try {
    const tournaments = await prisma.tournament.findMany({
      include: {
        clubs: { include: { club: true } },   // TournamentClub[]
        stops: true,                           // Stop[]
      },
    });

    const touched: any[] = [];

    for (const t of tournaments) {
      // Use brackets instead of levels (levels model doesn't exist)
      const levels = await prisma.tournamentBracket.findMany({
        where: { tournamentId: t.id },
        orderBy: { idx: 'asc' }
      });

      for (const tc of t.clubs) {
        // Load all existing teams for this tournament+club once
        const existingTeams = await prisma.team.findMany({
          where: { tournamentId: t.id, clubId: tc.clubId },
          select: { id: true, name: true, division: true, levelId: true },
        });
        const byDivision = new Map(existingTeams.map(et => [et.division, et]));

        for (const lvl of levels) {
          // 1) If a team already exists with this levelId, reuse it
          let team = existingTeams.find(et => et.levelId === (lvl as any).id);

          if (!team) {
            // 2) Try to map level name to a legacy division and reuse the matching team (attach levelId)
            const desiredDiv = inferDivision((lvl as any).name);
            if (desiredDiv && byDivision.has(desiredDiv)) {
              const et = byDivision.get(desiredDiv)!;
              if (!et.levelId) {
                await prisma.team.update({
                  where: { id: et.id },
                  data: { levelId: (lvl as any).id },
                });
                team = { ...et, levelId: (lvl as any).id };
                touched.push({ action: 'attachLevel', teamId: et.id, levelId: (lvl as any).id });
              } else {
                // already has some levelId — if it's not this one, we still **reuse** this team to avoid duplicates
                team = et;
              }
            }
          }

          if (!team) {
            // 3) No reusable team found:
            //    - If there is exactly ONE legacy team for this club, just attach levelId to it.
            //    - Else (no teams at all) create ONE new team (choose a division that isn't used yet).
            if (existingTeams.length === 1 && !existingTeams[0].levelId) {
              const et = existingTeams[0];
              await prisma.team.update({
                where: { id: et.id },
                data: { levelId: (lvl as any).id },
              });
              team = { ...et, levelId: (lvl as any).id };
              touched.push({ action: 'attachLevel_singleLegacy', teamId: et.id, levelId: (lvl as any).id });
            } else if (existingTeams.length === 0) {
              // pick a division that isn't used (INTERMEDIATE preferred)
              const useDiv = byDivision.has('INTERMEDIATE') ? 'ADVANCED' : 'INTERMEDIATE';
              const label = (lvl as any).name === 'DEFAULT'
                ? (tc.club?.name ?? 'Team')
                : `${tc.club?.name ?? 'Team'} ${(lvl as any).name}`;
              const created = await prisma.team.create({
                data: {
                  name: label,
                  tournamentId: t.id,
                  clubId: tc.clubId,
                  levelId: (lvl as any).id, // if your schema lacks levelId, Prisma will ignore it
                  division: useDiv as any,
                },
                select: { id: true, name: true, division: true, levelId: true },
              });
              existingTeams.push(created);
              byDivision.set(created.division as any, created);
              team = created;
              touched.push({ action: 'createTeam', teamId: created.id, division: created.division, levelId: created.levelId });
            } else {
              // Multiple legacy teams already exist; pick any without a levelId and attach
              const free = existingTeams.find(et => !et.levelId);
              if (free) {
                await prisma.team.update({
                  where: { id: free.id },
                  data: { levelId: (lvl as any).id },
                });
                team = { ...free, levelId: (lvl as any).id };
                touched.push({ action: 'attachLevel_multiLegacy', teamId: free.id, levelId: (lvl as any).id });
              } else {
                // As a last resort, just reuse the first team (no new create to avoid unique conflicts)
                team = existingTeams[0];
                touched.push({ action: 'reuseExisting', teamId: team.id, reason: 'no-free-slot' });
              }
            }
          }

          // 4) Ensure StopTeam links for all stops
          for (const s of t.stops) {
            await prisma.stopTeam.upsert({
              where: { stopId_teamId: { stopId: s.id, teamId: team.id } },
              update: {},
              create: { stopId: s.id, teamId: team.id },
            });
          }
        }
      }
    }

    return NextResponse.json({ ok: true, touched });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'sync failed' }, { status: 500 });
  }
}
