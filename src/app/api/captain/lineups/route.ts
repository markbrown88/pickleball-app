// src/app/api/captain/lineups/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { MatchSlot, Gender } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

/**
 * POST /api/captain/lineups
 * Body:
 * {
 *   "roundId": "rnd_...",
 *   "entries": [
 *     { "teamId": "tm_...", "slot": "MENS_DOUBLES", "player1Id": "pl_...", "player2Id": "pl_..." },
 *     { "teamId": "tm_...", "slot": "WOMENS_DOUBLES", "player1Id": "...", "player2Id": "..." },
 *     { "teamId": "tm_...", "slot": "MIXED_1",      "player1Id": "...", "player2Id": "..." },
 *     { "teamId": "tm_...", "slot": "MIXED_2",      "player1Id": "...", "player2Id": "..." },
 *     { "teamId": "tm_...", "slot": "TIEBREAKER",   "player1Id": "...", "player2Id": "..." }
 *   ]
 * }
 */
export async function POST(req: Request) {
  const prisma = getPrisma();

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { roundId, entries } = body as {
      roundId?: string;
      entries?: Array<{
        teamId: string;
        slot: MatchSlot | string;
        player1Id: string;
        player2Id: string;
      }>;
    };

    if (!roundId || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: roundId, entries[]" },
        { status: 400 }
      );
    }

    const enumValues = new Set(Object.values(MatchSlot));
    for (const e of entries) {
      if (
        !e?.teamId || !e?.slot || !e?.player1Id || !e?.player2Id ||
        typeof e.teamId !== "string" ||
        typeof e.player1Id !== "string" ||
        typeof e.player2Id !== "string"
      ) {
        return NextResponse.json(
          { error: "Each entry must include teamId, slot, player1Id, player2Id" },
          { status: 400 }
        );
      }
      if (!enumValues.has(e.slot as MatchSlot)) {
        return NextResponse.json({ error: `Invalid slot: ${e.slot}` }, { status: 400 });
      }
      if (e.player1Id === e.player2Id) {
        return NextResponse.json(
          { error: "player1Id and player2Id must be different" },
          { status: 400 }
        );
      }
    }

    // Round (need stopId)
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { stopId: true },
    });
    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // Group by team
    const byTeam = new Map<
      string,
      Array<{ slot: MatchSlot; player1Id: string; player2Id: string }>
    >();
    for (const e of entries) {
      const arr = byTeam.get(e.teamId) ?? [];
      arr.push({ slot: e.slot as MatchSlot, player1Id: e.player1Id, player2Id: e.player2Id });
      byTeam.set(e.teamId, arr);
    }

    const result: Array<{ teamId: string; lineupId: string; upserts: number }> = [];

    await prisma.$transaction(async (tx) => {
      for (const [teamId, teamEntries] of byTeam) {
        // Team must be registered for this stop
        const ok = await tx.stopTeam.findUnique({
          where: { stopId_teamId: { stopId: round.stopId, teamId } },
          select: { teamId: true },
        });
        if (!ok) {
          throw new Error(`Team ${teamId} is not registered for this stop`);
        }

        // Stop roster for this team
        const roster = await tx.stopTeamPlayer.findMany({
          where: { stopId: round.stopId, teamId },
          select: { playerId: true },
        });
        const rosterSet = new Set(roster.map((r) => r.playerId));
        if (rosterSet.size === 0) {
          throw new Error(`No roster set for team ${teamId} at this stop`);
        }

        // Fetch genders for involved players
        const involved = Array.from(new Set(teamEntries.flatMap(e => [e.player1Id, e.player2Id])));
        const genders = await tx.player.findMany({
          where: { id: { in: involved } },
          select: { id: true, gender: true },
        });
        const genderById = new Map(genders.map(g => [g.id, g.gender]));

        // Upsert Lineup by (roundId, teamId)
        const lineup = await tx.lineup.upsert({
          where: { roundId_teamId: { roundId, teamId } },
          update: {},
          create: { roundId, teamId },
          select: { id: true },
        });

        // Upsert each entry by (lineupId, slot) with roster + gender rules
        let count = 0;
        for (const ent of teamEntries) {
          // Roster enforcement
          if (!rosterSet.has(ent.player1Id) || !rosterSet.has(ent.player2Id)) {
            throw new Error(`Lineup contains a non-rostered player for team ${teamId}`);
          }

          // Gender rules
          const g1 = genderById.get(ent.player1Id);
          const g2 = genderById.get(ent.player2Id);
          if (!g1 || !g2) throw new Error("One or more players not found");

          if (ent.slot === "MENS_DOUBLES") {
            if (!(g1 === Gender.MALE && g2 === Gender.MALE)) {
              throw new Error("Mens Doubles requires two male players");
            }
          } else if (ent.slot === "WOMENS_DOUBLES") {
            if (!(g1 === Gender.FEMALE && g2 === Gender.FEMALE)) {
              throw new Error("Womens Doubles requires two female players");
            }
          } else if (ent.slot === "MIXED_1" || ent.slot === "MIXED_2") {
            if (!(g1 !== g2)) {
              throw new Error("Mixed requires one male and one female");
            }
          }
          // TIEBREAKER: no gender rule (change if you have one)

          await tx.lineupEntry.upsert({
            where: { lineupId_slot: { lineupId: lineup.id, slot: ent.slot } },
            update: { player1Id: ent.player1Id, player2Id: ent.player2Id },
            create: {
              lineupId: lineup.id,
              slot: ent.slot,
              player1Id: ent.player1Id,
              player2Id: ent.player2Id,
            },
          });
          count++;
        }

        result.push({ teamId, lineupId: lineup.id, upserts: count });
      }
    });

    return NextResponse.json({ roundId, result }, { status: 200 });
  } catch (err: any) {
    console.error("Lineups POST error:", err);
    return NextResponse.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 });
  }
}
