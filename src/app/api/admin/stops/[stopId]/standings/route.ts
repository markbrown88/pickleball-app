// src/app/api/admin/stops/[stopId]/standings/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ stopId: string }> };

// 3-1-0 points system at the game level (win/loss/forfeit)
const GAME_WIN_POINTS = 3;
const GAME_LOSS_POINTS = 1;
const GAME_FORFEIT_POINTS = 0;

// Each decided slot is worth 1 point to the winner, 0.5 each on ties
const SLOT_WIN_POINTS = 1;
const SLOT_TIE_POINTS = 0.5;

/** Coerce a possibly-empty or "null" string into a nullable id. */
function normalizeBracketId(v: unknown): string | null | undefined {
  if (v === undefined) return undefined; // means "all brackets"
  if (v === null) return null;
  const s = String(v).trim();
  if (s === '' || s.toLowerCase() === 'null') return null;
  return s;
}

type TeamRow = {
  teamId: string;
  teamName: string;
  bracketId: string | null;
  bracketName: string | null;

  played: number;
  wins: number;
  losses: number;
  ties: number;
  undecided: number;

  slotWins: number;
  slotLosses: number;
  slotTies: number;

  points: number;
  slotPoints: number;

  scoreFor: number;
  scoreAgainst: number;
  scoreDiff: number;
};

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { stopId } = await ctx.params;
    // Use singleton prisma instance
    const { searchParams } = new URL(req.url);
    const bracketFilter = normalizeBracketId(searchParams.get('bracketId'));

    // Validate stop
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: {
        id: true,
        name: true,
        tournamentId: true,
        tournament: {
          select: {
            id: true,
            name: true,
            brackets: { select: { id: true, name: true }, orderBy: { idx: 'asc' } },
          },
        },
      },
    });
    if (!stop) {
      return NextResponse.json({ error: `Stop not found: ${stopId}` }, { status: 404 });
    }

    // Preload all rounds/games/matches for this stop
    const rounds = await prisma.round.findMany({
      where: { stopId },
      orderBy: { idx: 'asc' },
      select: {
        id: true,
        idx: true,
        games: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            isBye: true, // scalar must be under select
            teamA: {
              select: {
                id: true,
                name: true,
                bracket: { select: { id: true, name: true } },
              },
            },
            teamB: {
              select: {
                id: true,
                name: true,
                bracket: { select: { id: true, name: true } },
              },
            },
            matches: {
              orderBy: { slot: 'asc' },
              select: {
                id: true,
                slot: true,
                teamAScore: true,
                teamBScore: true,
                match: {
                  select: {
                    forfeitTeam: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Seed team rows
    const table = new Map<string, TeamRow>();
    const ensureRow = (
      t: { id: string; name: string; bracket?: { id: string; name: string } | null } | null
    ) => {
      if (!t) return;
      if (!table.has(t.id)) {
        table.set(t.id, {
          teamId: t.id,
          teamName: t.name,
          bracketId: t.bracket?.id ?? null,
          bracketName: t.bracket?.name ?? null,
          played: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          undecided: 0,
          slotWins: 0,
          slotLosses: 0,
          slotTies: 0,
          points: 0,
          slotPoints: 0,
          scoreFor: 0,
          scoreAgainst: 0,
          scoreDiff: 0,
        });
      }
    };

    // Track unique decided games for totals
    let decidedGamesCount = 0;

    // First pass: create rows and tally
    for (const r of rounds) {
      for (const g of r.games) {
        const inferredBracketId = g.teamA?.bracket?.id ?? g.teamB?.bracket?.id ?? null;
        if (bracketFilter !== undefined && inferredBracketId !== bracketFilter) continue;

        if (g.isBye || !g.teamA || !g.teamB) continue;

        ensureRow(g.teamA);
        ensureRow(g.teamB);

        const rowA = table.get(g.teamA.id)!;
        const rowB = table.get(g.teamB.id)!;

        let aSlotWins = 0;
        let bSlotWins = 0;
        let slotTies = 0;
        let scoredSlots = 0;

        const totalSlots = g.matches.length || 0;
        const needed = totalSlots > 0 ? Math.floor(totalSlots / 2) + 1 : 0;

        // Check if this game has a forfeit - look for any game with forfeit
        const forfeitTeam = g.matches.find(m => m.match?.forfeitTeam)?.match?.forfeitTeam;
        
        if (forfeitTeam) {
          console.log(`[STANDINGS] Game ${g.id} has forfeit: Team ${forfeitTeam} forfeited (${g.teamA?.name} vs ${g.teamB?.name})`);
          
          // Handle forfeit - team that didn't forfeit gets the win
          rowA.played++;
          rowB.played++;
          decidedGamesCount++;
          
          if (forfeitTeam === 'B') {
            // Team B forfeited, Team A wins
            rowA.wins++;
            rowB.losses++;
            rowA.points += GAME_WIN_POINTS; // 3 points for win
            rowB.points += GAME_FORFEIT_POINTS; // 0 points for forfeit
            console.log(`[STANDINGS] Team A (${g.teamA?.name}) gets win, Team B (${g.teamB?.name}) gets loss`);
          } else {
            // Team A forfeited, Team B wins
            rowB.wins++;
            rowA.losses++;
            rowB.points += GAME_WIN_POINTS; // 3 points for win
            rowA.points += GAME_FORFEIT_POINTS; // 0 points for forfeit
            console.log(`[STANDINGS] Team B (${g.teamB?.name}) gets win, Team A (${g.teamA?.name}) gets loss`);
          }
        }

        // Only process normal game logic if there's no forfeit
        if (!forfeitTeam) {
          // Normal scoring logic
          for (const m of g.matches) {
            const a = m.teamAScore;
            const b = m.teamBScore;
            if (a == null || b == null) continue;

            scoredSlots++;
            rowA.scoreFor += a;
            rowA.scoreAgainst += b;
            rowB.scoreFor += b;
            rowB.scoreAgainst += a;

            if (a > b) {
              aSlotWins++;
              rowA.slotWins++;
              rowB.slotLosses++;
              rowA.slotPoints += SLOT_WIN_POINTS;
            } else if (b > a) {
              bSlotWins++;
              rowB.slotWins++;
              rowA.slotLosses++;
              rowB.slotPoints += SLOT_WIN_POINTS;
            } else {
              slotTies++;
              rowA.slotTies++;
              rowB.slotTies++;
              rowA.slotPoints += SLOT_TIE_POINTS;
              rowB.slotPoints += SLOT_TIE_POINTS;
            }
          }
          const allScored = totalSlots > 0 && scoredSlots === totalSlots;
          const aClinched = needed > 0 && aSlotWins >= needed;
          const bClinched = needed > 0 && bSlotWins >= needed;

          if (aClinched || bClinched || (allScored && aSlotWins !== bSlotWins)) {
            rowA.played++;
            rowB.played++;
            decidedGamesCount++;

            if (aClinched || aSlotWins > bSlotWins) {
              rowA.wins++;
              rowB.losses++;
              rowA.points += GAME_WIN_POINTS;
              rowB.points += GAME_LOSS_POINTS;
            } else {
              rowB.wins++;
              rowA.losses++;
              rowB.points += GAME_WIN_POINTS;
              rowA.points += GAME_LOSS_POINTS;
            }
          } else {
            rowA.undecided++;
            rowB.undecided++;
          }
        }
      }
    }

    const rows = Array.from(table.values()).map((r) => ({
      ...r,
      scoreDiff: r.scoreFor - r.scoreAgainst,
    }));

    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.slotPoints !== a.slotPoints) return b.slotPoints - a.slotPoints;
      if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
      return a.teamName.localeCompare(b.teamName);
    });

    const byBracket: Record<string, { bracketId: string | null; bracketName: string | null; teams: TeamRow[] }> = {};
    for (const r of rows) {
      const key = r.bracketId ?? 'null';
      if (!byBracket[key]) {
        byBracket[key] = {
          bracketId: r.bracketId,
          bracketName: r.bracketName ?? (r.bracketId === null ? 'Unassigned' : null),
          teams: [],
        };
      }
      byBracket[key].teams.push(r);
    }

    return NextResponse.json({
      stop: { id: stop.id, name: stop.name, tournamentId: stop.tournamentId },
      bracketId: bracketFilter ?? undefined,
      brackets: stop.tournament?.brackets ?? [],
      standings: byBracket,
      totals: {
        teams: rows.length,
        gamesCounted: decidedGamesCount,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to compute standings' }, { status: 500 });
  }
}
