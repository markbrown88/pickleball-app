// src/app/api/captain/[playerId]/rounds/[roundId]/lineups/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { GameSlot, Gender } from '@prisma/client';

type Params = { playerId: string; roundId: string };

type PlayerLite = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  gender: Gender;
  dupr?: number | null;
  age?: number | null;
};

type LineupEntryWithPlayers = {
  slot: GameSlot;
  player1: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    gender: Gender;
    dupr: number | null;
    age: number | null;
    birthday: Date | null;
  } | null;
  player2: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    gender: Gender;
    dupr: number | null;
    age: number | null;
    birthday: Date | null;
  } | null;
};

type PlayerSelectResult = LineupEntryWithPlayers['player1'];

function label(p: PlayerLite) {
  const fn = (p.firstName ?? '').trim();
  const ln = (p.lastName ?? '').trim();
  return [fn, ln].filter(Boolean).join(' ') || (p.name ?? 'Unknown');
}

function toPlayerLite(player: PlayerSelectResult | null): PlayerLite | null {
  if (!player) return null;
  const { id, firstName, lastName, name, gender, dupr, age, birthday } = player;
  const computedAge =
    age ?? (birthday ? Math.floor((Date.now() - Number(new Date(birthday))) / (365.25 * 24 * 3600 * 1000)) : null);
  return {
    id,
    firstName,
    lastName,
    name: name ?? label({ id, firstName, lastName, name, gender, dupr, age: computedAge }),
    gender,
    dupr: dupr ?? null,
    age: computedAge,
  };
}

/* ========================= GET =========================
   Returns:
   {
     roundId,
     stopId,
     tournamentId,
     games: [
       {
         gameId, isBye,
         teamA?: { id, name, club?:{id,name}, bracket?:{id,name}, canEdit: boolean },
         teamB?: { ... }
       }, ...
     ],
     lineups: {
       [teamId]: {
         canEdit: boolean,
         entries: Array<{ slot: GameSlot, p1: PlayerLite | null, p2: PlayerLite | null }>
       }
     }
   }
*/
export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  // Use singleton prisma instance
  const { playerId, roundId } = await ctx.params;

  try {
    // Round scope (need stopId -> tournamentId)
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, stopId: true, stop: { select: { id: true, tournamentId: true } } },
    });
    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Governance within this tournament
    const tournamentId = round.stop.tournamentId;
    const [caps, legacyTeams] = await Promise.all([
      prisma.tournamentCaptain.findMany({
        where: { tournamentId, playerId },
        select: { clubId: true },
      }),
      prisma.team.findMany({
        where: { tournamentId, captainId: playerId },
        select: { clubId: true },
      }),
    ]);
    const governedClubIds = new Set<string>();
    for (const c of caps) if (c.clubId) governedClubIds.add(c.clubId);
    for (const t of legacyTeams) if (t.clubId) governedClubIds.add(t.clubId);

    // Round games with minimal team data
    const matches = await prisma.match.findMany({
      where: { roundId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        isBye: true,
        teamA: {
          select: {
            id: true,
            name: true,
            club: { select: { id: true, name: true } },
            bracket: { select: { id: true, name: true } },
          },
        },
        teamB: {
          select: {
            id: true,
            name: true,
            club: { select: { id: true, name: true } },
            bracket: { select: { id: true, name: true } },
          },
        },
        games: {
          orderBy: { slot: 'asc' },
          select: {
            id: true,
            slot: true,
          },
        },
      },
    });

    // Collect all teamIds present in this round
    const teamIds = new Set<string>();
    matches.forEach((matchRecord) => {
      if (matchRecord.teamA?.id) teamIds.add(matchRecord.teamA.id);
      if (matchRecord.teamB?.id) teamIds.add(matchRecord.teamB.id);
    });

    // Load all existing lineups for these teams in this round (if any)
    const lineupsRaw = await prisma.lineup.findMany({
      where: { roundId, teamId: { in: Array.from(teamIds) } },
      select: {
        teamId: true,
        entries: {
          select: {
            slot: true,
            player1: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                name: true,
                gender: true,
                dupr: true,
                age: true,
                birthday: true,
              },
            },
            player2: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                name: true,
                gender: true,
                dupr: true,
                age: true,
                birthday: true,
              },
            },
          },
          orderBy: { slot: 'asc' },
        },
      },
    });

    // Map lineups by teamId
    const lineups: Record<
      string,
      { canEdit: boolean; entries: Array<{ slot: GameSlot; p1: PlayerLite | null; p2: PlayerLite | null }> }
    > = {};

    // Accepts undefined or null safely
    const canEditByTeam = (team?: { club?: { id: string | null } | null } | null) => {
      const cid = team?.club?.id ?? null;
      return !!(cid && governedClubIds.has(cid));
    };

    // Initialize with existing entries
    for (const lu of lineupsRaw) {
      lineups[lu.teamId] = {
        canEdit: false, // fill later per game
        entries: lu.entries.map((entry) => ({
          slot: entry.slot,
          p1: toPlayerLite(entry.player1),
          p2: toPlayerLite(entry.player2),
        })),
      };
    }

    // Shape games and mark editability; also ensure lineup entries exist in the map (possibly empty)
    const shapedGames = matches.map((matchRecord) => {
      const tA = matchRecord.teamA
        ? {
            id: matchRecord.teamA.id,
            name: matchRecord.teamA.name,
            club: matchRecord.teamA.club
              ? { id: matchRecord.teamA.club.id, name: matchRecord.teamA.club.name }
              : undefined,
            bracket: matchRecord.teamA.bracket
              ? { id: matchRecord.teamA.bracket.id, name: matchRecord.teamA.bracket.name }
              : undefined,
          }
        : undefined;
      const tB = matchRecord.teamB
        ? {
            id: matchRecord.teamB.id,
            name: matchRecord.teamB.name,
            club: matchRecord.teamB.club
              ? { id: matchRecord.teamB.club.id, name: matchRecord.teamB.club.name }
              : undefined,
            bracket: matchRecord.teamB.bracket
              ? { id: matchRecord.teamB.bracket.id, name: matchRecord.teamB.bracket.name }
              : undefined,
          }
        : undefined;

      const canEditA = canEditByTeam(matchRecord.teamA ?? undefined);
      const canEditB = canEditByTeam(matchRecord.teamB ?? undefined);

      if (tA && !lineups[tA.id]) lineups[tA.id] = { canEdit: canEditA, entries: [] };
      if (tB && !lineups[tB.id]) lineups[tB.id] = { canEdit: canEditB, entries: [] };
      if (tA) lineups[tA.id].canEdit = canEditA;
      if (tB) lineups[tB.id].canEdit = canEditB;

      return {
        matchId: matchRecord.id,
        isBye: matchRecord.isBye,
        teamA: tA ? { ...tA, canEdit: canEditA } : undefined,
        teamB: tB ? { ...tB, canEdit: canEditB } : undefined,
        slots: matchRecord.games.map((g) => g.slot).filter((slot): slot is GameSlot => slot != null),
      };
    });

    return NextResponse.json({
      roundId,
      stopId: round.stopId,
      tournamentId,
      matches: shapedGames,
      lineups,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to load lineups', detail: message }, { status: 500 });
  }
}

/* ========================= PUT =========================
   Replace lineup for one team in this round.

   Body:
   {
     teamId: string,
     entries: Array<{ slot: GameSlot, player1Id: string | null, player2Id: string | null }>
   }

   Rules:
   - Caller must be captain for this team’s club (TournamentCaptain or legacy Team.captainId).
   - Both players (when provided) must be on the team’s roster for the round’s stop.
   - No duplicate player across slots in the same lineup.
*/
export async function PUT(req: Request, ctx: { params: Promise<Params> }) {
  // Use singleton prisma instance
  const { playerId, roundId } = await ctx.params;

  try {
    const body = await req.json().catch(() => ({}));
    const teamId: string | undefined = typeof body?.teamId === 'string' ? body.teamId : undefined;
    const entries: Array<{ slot: GameSlot; player1Id: string | null; player2Id: string | null }> = Array.isArray(
      body?.entries
    )
      ? body.entries
      : [];

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Round / Stop / Tournament scope
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, stopId: true, stop: { select: { id: true, tournamentId: true } } },
    });
    if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 });

    // Team scope & same tournament
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, clubId: true, tournamentId: true },
    });
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    if (team.tournamentId !== round.stop.tournamentId) {
      return NextResponse.json({ error: 'Team does not belong to this round’s tournament' }, { status: 400 });
    }

    // Governance check
    const tournamentId = round.stop.tournamentId;
    const [caps, legacy] = await Promise.all([
      prisma.tournamentCaptain.findMany({
        where: { tournamentId, playerId },
        select: { clubId: true },
      }),
      prisma.team.findMany({
        where: { tournamentId, captainId: playerId },
        select: { clubId: true },
      }),
    ]);
    const governedClubIds = new Set<string>();
    for (const c of caps) if (c.clubId) governedClubIds.add(c.clubId);
    for (const t of legacy) if (t.clubId) governedClubIds.add(t.clubId);
    if (!(team.clubId && governedClubIds.has(team.clubId))) {
      return NextResponse.json({ error: 'Not authorized to set lineup for this team' }, { status: 403 });
    }

    // Validate roster membership against Stop roster for this team
    const stopId = round.stopId;
    const roster = await prisma.stopTeamPlayer.findMany({
      where: { stopId, teamId },
      select: { playerId: true },
    });
    const rosterSet = new Set(roster.map((r) => r.playerId));

    // Validate entries
    const seenPlayers = new Set<string>();
    for (const e of entries) {
      const p1 = e.player1Id || undefined;
      const p2 = e.player2Id || undefined;

      // Allow a slot to be cleared if either is missing -> we'll just not create that entry
      if (!p1 || !p2) continue;

      if (p1 === p2) {
        return NextResponse.json(
          { error: `Duplicate players in a slot (${String(e.slot)}): ${p1}` },
          { status: 400 }
        );
      }
      if (!rosterSet.has(p1) || !rosterSet.has(p2)) {
        return NextResponse.json(
          { error: `Players must be on this stop's roster for the team`, slot: e.slot },
          { status: 400 }
        );
      }
      if (seenPlayers.has(p1) || seenPlayers.has(p2)) {
        return NextResponse.json(
          { error: `A player cannot appear in multiple slots for the same round lineup` },
          { status: 400 }
        );
      }
      seenPlayers.add(p1);
      seenPlayers.add(p2);
    }

    // Apply changes: ensure Lineup row; replace its entries
    const result = await prisma.$transaction(async (tx) => {
      const lineup = await tx.lineup.upsert({
        where: { roundId_teamId: { roundId, teamId } },
        update: {},
        create: { roundId, teamId },
        select: { id: true },
      });

      // Replace entries completely
      await tx.lineupEntry.deleteMany({ where: { lineupId: lineup.id } });
      const createData = entries
        .filter((e) => e.player1Id && e.player2Id)
        .map((e) => ({
          lineupId: lineup.id,
          slot: e.slot,
          player1Id: e.player1Id as string,
          player2Id: e.player2Id as string,
        }));
      if (createData.length) {
        await tx.lineupEntry.createMany({ data: createData, skipDuplicates: true });
      }

      // Return fresh lineup with players
      const fresh = await tx.lineup.findUnique({
        where: { id: lineup.id },
        select: {
          teamId: true,
          entries: {
            select: {
              slot: true,
              player1: {
                select: {
                  id: true, firstName: true, lastName: true, name: true, gender: true, dupr: true, age: true, birthday: true,
                },
              },
              player2: {
                select: {
                  id: true, firstName: true, lastName: true, name: true, gender: true, dupr: true, age: true, birthday: true,
                },
              },
            },
            orderBy: { slot: 'asc' },
          },
        },
      });

      return fresh;
    });

    const shapedLineup = {
      teamId: result?.teamId ?? teamId,
      entries: (result?.entries ?? []).map((entry) => ({
        slot: entry.slot,
        p1: toPlayerLite(entry.player1),
        p2: toPlayerLite(entry.player2),
      })),
    };

    return NextResponse.json({ ok: true, roundId, stopId, tournamentId, lineup: shapedLineup });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to save lineup', detail: message }, { status: 500 });
  }
}
