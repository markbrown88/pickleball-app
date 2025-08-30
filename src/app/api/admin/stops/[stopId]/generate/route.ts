import { NextResponse } from "next/server";
import { MatchSlot } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Five slots per Game, per your enum
const SLOTS: readonly MatchSlot[] = [
  "MENS_DOUBLES",
  "WOMENS_DOUBLES",
  "MIXED_1",
  "MIXED_2",
  "TIEBREAKER",
] as const;

export async function POST(
  req: Request,
  ctx: { params: { stopId: string } }
) {
  const prisma = getPrisma();

  try {
    const stopId = ctx.params?.stopId;
    if (!stopId) {
      return NextResponse.json({ error: "Missing stopId" }, { status: 400 });
    }

    const url = new URL(req.url);
    const reset =
      url.searchParams.get("reset") === "1" ||
      url.searchParams.get("reset") === "true";

    // Teams for this Stop are via the StopTeam join table
    const stopTeams = await prisma.stopTeam.findMany({
      where: { stopId },
      select: { teamId: true },
      orderBy: { teamId: "asc" },
    });
    const teamIds = stopTeams.map((t) => t.teamId);

    if (teamIds.length < 2) {
      return NextResponse.json(
        { error: "Need at least two teams to generate a schedule." },
        { status: 400 }
      );
    }

    // Guard against accidental double-gen unless reset requested
    const existingRounds = await prisma.round.count({ where: { stopId } });
    if (existingRounds > 0 && !reset) {
      return NextResponse.json(
        {
          error:
            "Rounds already exist for this stop. Re-run with ?reset=1 to overwrite.",
        },
        { status: 409 }
      );
    }

    // If resetting, delete Matches -> Games -> Rounds in that order
    if (reset) {
      await prisma.$transaction([
        prisma.match.deleteMany({ where: { game: { round: { stopId } } } }),
        prisma.game.deleteMany({ where: { round: { stopId } } }),
        prisma.round.deleteMany({ where: { stopId } }),
      ]);
    }

    // Build round-robin including explicit BYEs
    const pairingsByRound = makeRoundRobinWithByes(teamIds);

    let totalGames = 0;
    let totalMatches = 0;
    let totalByes = 0;

    await prisma.$transaction(async (tx) => {
      for (let r = 0; r < pairingsByRound.length; r++) {
        const round = await tx.round.create({
          data: { stopId, idx: r + 1 },
        });

        for (const [a, b] of pairingsByRound[r]) {
          // BYE: one team paired with null
          if (a === null || b === null) {
            const onlyTeam = (a ?? b)!;
            await tx.game.create({
              data: {
                roundId: round.id,
                teamAId: onlyTeam,
                teamBId: null,
                isBye: true,
              },
            });
            totalGames++;
            totalByes++;
            continue;
          }

          // Regular fixture
          const game = await tx.game.create({
            data: { roundId: round.id, teamAId: a, teamBId: b, isBye: false },
          });
          totalGames++;

          // Five matches per fixture
          await Promise.all(
            SLOTS.map((slot) =>
              tx.match.create({
                data: { gameId: game.id, slot },
              })
            )
          );
          totalMatches += SLOTS.length;
        }
      }
    });

    return NextResponse.json({
      stopId,
      teams: teamIds.length,
      rounds: pairingsByRound.length,
      games: totalGames,
      matches: totalMatches,
      byes: totalByes,
      resetApplied: reset,
      message: "Round-robin schedule generated.",
    });
  } catch (err: any) {
    console.error("Generate schedule error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Round-robin (circle method) that RETURNS BYE PAIRS explicitly.
 * For odd team counts we insert `null`; any [team, null] pair becomes a BYE.
 */
function makeRoundRobinWithByes<T>(
  teamIds: T[]
): Array<Array<[T | null, T | null]>> {
  const ids = [...teamIds];
  const isOdd = ids.length % 2 === 1;
  if (isOdd) (ids as (T | null)[]).push(null);

  const n = ids.length;
  if (n < 2) return [];

  const fixed = ids[0];
  let rotating = ids.slice(1);

  const rounds: Array<Array<[T | null, T | null]>> = [];
  for (let r = 0; r < n - 1; r++) {
    const left = [fixed, ...rotating.slice(0, (n - 2) / 2)];
    const right = rotating.slice((n - 2) / 2).reverse();
    const pairs: Array<[T | null, T | null]> = [];

    for (let i = 0; i < left.length; i++) {
      pairs.push([left[i] ?? null, right[i] ?? null]);
    }

    rounds.push(pairs);
    // rotate: last goes to front
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  return rounds;
}
