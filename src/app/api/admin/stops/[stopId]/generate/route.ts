// src/app/api/admin/stops/[stopId]/generate/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { GameSlot } from '@prisma/client';
import { GameSlot as GameSlotEnum } from '@prisma/client';

type Ctx = { params: Promise<{ stopId: string }> };

type GenerateBody = {
  /** If provided, only generate for this bracket; otherwise all brackets at the stop. */
  bracketId?: string | null;
  /** If true, delete existing rounds/games/matches for this stop before generating. */
  overwrite?: boolean;
  /** Optional slots to seed per game; defaults to all five. */
  slots?: GameSlot[];
};

const DEFAULT_SLOTS: GameSlot[] = [
  GameSlotEnum.MENS_DOUBLES,
  GameSlotEnum.WOMENS_DOUBLES,
  GameSlotEnum.MIXED_1,
  GameSlotEnum.MIXED_2,
  GameSlotEnum.TIEBREAKER,
];

/** Coerce a possibly-empty or "null" string into a nullable id. */
function normalizeBracketId(v: unknown): string | null | undefined {
  if (v === undefined) return undefined; // means "all brackets"
  if (v === null) return null;
  const s = String(v).trim();
  if (s === '' || s.toLowerCase() === 'null') return null;
  return s;
}

/** Fisher-Yates shuffle to randomize array order */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Deterministic round-robin (circle method) with BYE handling. */
function generateRoundRobin(teamIds: string[]) {
  const ids = [...teamIds];
  const rounds: { games: Array<{ a: string | null; b: string | null; isBye: boolean }> }[] = [];

  const isOdd = ids.length % 2 === 1;
  if (isOdd) ids.push('__BYE__');

  const n = ids.length;
  if (n <= 1) return rounds;

  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const games: Array<{ a: string | null; b: string | null; isBye: boolean }> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      const isBye = a === '__BYE__' || b === '__BYE__';
      games.push({
        a: a === '__BYE__' ? null : a,
        b: b === '__BYE__' ? null : b,
        isBye,
      });
    }
    rounds.push({ games });

    // rotate: keep first fixed; move last into position 1
    arr.splice(1, 0, arr.pop() as string);
  }
  return rounds;
}

export async function POST(req: Request, ctx: Ctx) {
  // Use singleton prisma instance
  const { stopId } = await ctx.params;

  try {
    const raw = await req.json().catch(() => ({}));
    const body = (raw ?? {}) as GenerateBody;

    const overwrite = !!body.overwrite;

    // Validate/normalize slots (guard against invalid enum strings from the client)
    const validSlots = new Set(Object.values(GameSlotEnum));
    const requestedSlots = Array.isArray(body.slots) ? body.slots : [];
    const slots =
      requestedSlots.length && requestedSlots.every((s) => validSlots.has(s as unknown as GameSlot))
        ? (requestedSlots.slice() as GameSlot[])
        : DEFAULT_SLOTS.slice();

    // Validate stop
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: { id: true, name: true, tournamentId: true },
    });
    if (!stop) {
      return NextResponse.json({ error: `Stop not found: ${stopId}` }, { status: 404 });
    }

    // Get clubs participating in this tournament
    const tournamentClubs = await prisma.tournamentClub.findMany({
      where: { tournamentId: stop.tournamentId },
      select: { clubId: true }
    });
    const participatingClubIds = new Set(tournamentClubs.map(tc => tc.clubId));

    // Find participating teams at this stop (via StopTeam), filtered by tournament clubs
    const stopTeams = await prisma.stopTeam.findMany({
      where: {
        stopId,
        team: {
          clubId: { in: Array.from(participatingClubIds) }
        }
      },
      include: {
        team: {
          select: { id: true, name: true, bracketId: true, clubId: true, division: true },
        },
      },
    });

    // Get tournament brackets to understand the structure
    const tournament = await prisma.tournament.findUnique({
      where: { id: stop.tournamentId },
      include: {
        brackets: {
          orderBy: { idx: 'asc' },
          select: { id: true, name: true }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Group teams by bracket and club for proper club-based matchups
    const bracketGroups = new Map<string, Map<string, Array<{ id: string; name: string }>>>();
    const bracketFilter = normalizeBracketId(body.bracketId);

    console.log(`Found ${stopTeams.length} stop teams`);
    console.log(`Tournament brackets:`, tournament.brackets.map(b => ({ id: b.id, name: b.name })));

    for (const st of stopTeams) {
      if (!st.team) continue;

      // Find the bracket for this team - use bracketId if available, otherwise map from division
      let teamBracket = tournament.brackets.find(b => b.id === st.team.bracketId);
      let bracketKey = teamBracket?.name ?? 'UNBRACKETED';
      
      // If no bracketId is set, try to map from division to bracket name
      if (!teamBracket && st.team.division) {
        const divisionToBracket: Record<string, string> = {
          'ADVANCED': 'Advanced',
          'INTERMEDIATE': 'Intermediate',
          'BEGINNER': 'Beginner'
        };
        const mappedBracketName = divisionToBracket[st.team.division];
        if (mappedBracketName) {
          teamBracket = tournament.brackets.find(b => b.name === mappedBracketName);
          bracketKey = mappedBracketName;
        }
      }
      
      // Skip teams that don't have a valid bracket
      if (!teamBracket) {
        console.log(`Skipping team ${st.team.name}: No valid bracket found (bracketId: ${st.team.bracketId}, division: ${st.team.division})`);
        continue;
      }
      
      const clubKey = st.team.clubId ?? 'unassigned';

      console.log(`Team: ${st.team.name}, Bracket: ${bracketKey} (${st.team.bracketId}), Division: ${st.team.division}, Club: ${clubKey}`);

      // If a specific bracket was requested:
      if (bracketFilter !== undefined && st.team.bracketId !== bracketFilter) continue;

      if (!bracketGroups.has(bracketKey)) {
        bracketGroups.set(bracketKey, new Map());
      }
      
      const clubGroups = bracketGroups.get(bracketKey)!;
      if (!clubGroups.has(clubKey)) {
        clubGroups.set(clubKey, []);
      }
      
      clubGroups.get(clubKey)!.push({ id: st.team.id, name: st.team.name });
    }

    console.log(`Bracket groups:`, Array.from(bracketGroups.entries()).map(([bracket, clubs]) => [
      bracket, 
      Array.from(clubs.entries()).map(([club, teams]) => [club, teams.length])
    ]));

    // If no teams hit at all:
    if (bracketGroups.size === 0) {
      if (bracketFilter !== undefined) {
        return NextResponse.json(
          { error: 'No teams found for the specified bracket at this stop.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Not enough teams at this stop to generate a schedule.' },
        { status: 400 }
      );
    }

    // Validate that each bracket has at least 2 clubs
    for (const [bracketKey, clubGroups] of bracketGroups) {
      if (clubGroups.size < 2) {
        // With <2 clubs in a bracket, no games can be generated; drop this bracket.
        bracketGroups.delete(bracketKey);
        continue;
      }
      
      // Shuffle teams within each club for randomized matchups
      for (const [clubKey, teams] of clubGroups) {
        clubGroups.set(clubKey, shuffleArray(teams));
      }
    }

    if (bracketGroups.size === 0) {
      return NextResponse.json(
        { error: 'Every bracket at this stop has fewer than two clubs; nothing to generate.' },
        { status: 400 }
      );
    }

    // Determine base index for new rounds
    let baseIdx = 0;

    const res = await prisma.$transaction(async (tx) => {
      if (overwrite) {
        // Delete existing schedule for this stop (Rounds cascade → Matches → Games)
        await tx.round.deleteMany({ where: { stopId } });
        baseIdx = 0;
      } else {
        // Append after the last existing round
        const last = await tx.round.findFirst({
          where: { stopId },
          orderBy: { idx: 'desc' },
          select: { idx: true },
        });
        baseIdx = (last?.idx ?? -1) + 1;
      }

      // Precompute all brackets' club-based round-robin pairings
      type Pairing = ReturnType<typeof generateRoundRobin>;
      const pairingsByBracket: Array<{ bracketId: string | null; rounds: Pairing }> = [];
      let maxRoundsNeeded = 0;

      for (const [bracketKey, clubGroups] of bracketGroups) {
        // Get all teams for this bracket (one per club)
        const teamsForBracket: Array<{ id: string; name: string; clubId: string }> = [];
        
        for (const [clubId, teams] of clubGroups) {
          if (teams.length > 0) {
            // Take the first team from each club
            const team = teams[0];
            console.log(`Adding team ${team.name} (${team.id}) from club ${clubId} to bracket ${bracketKey}`);
            teamsForBracket.push({
              id: team.id,
              name: team.name,
              clubId: clubId
            });
          } else {
            console.log(`Warning: Club ${clubId} has no teams in bracket ${bracketKey}`);
          }
        }
        
        // Generate round-robin using team IDs
        const teamIds = teamsForBracket.map(t => t.id);
        console.log(`Bracket ${bracketKey}: Team IDs for round-robin:`, teamIds);

        // Validate that we have valid team IDs
        if (teamIds.length < 2) {
          console.log(`Skipping bracket ${bracketKey}: Not enough teams (${teamIds.length})`);
          continue;
        }

        // Check for null/undefined team IDs
        const invalidIds = teamIds.filter(id => !id || id === 'null' || id === 'undefined');
        if (invalidIds.length > 0) {
          console.log(`Skipping bracket ${bracketKey}: Invalid team IDs found:`, invalidIds);
          continue;
        }

        // Shuffle team order to randomize matchup sequence while maintaining round-robin property
        const shuffledTeamIds = shuffleArray(teamIds);
        console.log(`Bracket ${bracketKey}: Shuffled team IDs:`, shuffledTeamIds);

        const rr = generateRoundRobin(shuffledTeamIds);
        
        // Validate that all team IDs exist in the database
        const existingTeams = await tx.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true }
        });
        const existingTeamIds = new Set(existingTeams.map(t => t.id));
        const missingTeamIds = teamIds.filter(id => !existingTeamIds.has(id));
        
        if (missingTeamIds.length > 0) {
          console.log(`Skipping bracket ${bracketKey}: Missing team IDs in database:`, missingTeamIds);
          continue;
        }
        
        // Convert to the expected format
        const teamRounds = rr.map(round => ({
          games: round.games.map(game => ({
            a: game.a,
            b: game.b,
            isBye: game.isBye
          }))
        }));
        
        pairingsByBracket.push({ bracketId: bracketKey, rounds: teamRounds });
        if (teamRounds.length > maxRoundsNeeded) maxRoundsNeeded = teamRounds.length;
      }

      // Create Round rows for the full range we need (shared across brackets)
      const roundIds: string[] = [];
      for (let r = 0; r < maxRoundsNeeded; r++) {
        const created = await tx.round.create({
          data: { stopId, idx: baseIdx + r },
          select: { id: true },
        });
        roundIds.push(created.id);
      }

      // Now create Matches (and Games) for each bracket's pairing per round
      let matchesCreated = 0;
      let gamesCreated = 0;

      // Collect all matches to create in batches
      const matchesToCreate: Array<{
        roundId: string;
        teamAId: string | null;
        teamBId: string | null;
        isBye: boolean;
      }> = [];

      for (const { bracketId, rounds } of pairingsByBracket) {
        for (let r = 0; r < rounds.length; r++) {
          const roundId = roundIds[r];
          const { games } = rounds[r];

          for (const g of games) {
            matchesToCreate.push({
              roundId,
              teamAId: g.a,
              teamBId: g.b,
              isBye: !!g.isBye,
            });
          }
        }
      }

      // Create all matches in batches
      const batchSize = 100;
      for (let i = 0; i < matchesToCreate.length; i += batchSize) {
        const batch = matchesToCreate.slice(i, i + batchSize);
        const createdMatches = await tx.match.createManyAndReturn({
          data: batch,
          select: { id: true, isBye: true },
        });
        matchesCreated += createdMatches.length;

        // Create games for non-BYE matches
        const gamesToCreate: Array<{
          matchId: string;
          slot: GameSlot;
        }> = [];

        for (const match of createdMatches) {
          if (!match.isBye) {
            for (const slot of slots) {
              gamesToCreate.push({
                matchId: match.id,
                slot,
              });
            }
          }
        }

        if (gamesToCreate.length > 0) {
          await tx.game.createMany({
            data: gamesToCreate,
            skipDuplicates: true,
          });
          gamesCreated += gamesToCreate.length;
        }
      }

      return {
        roundsCreated: roundIds.length,
        matchesCreated,
        gamesCreated,
        startIdx: baseIdx,
        endIdx: baseIdx + Math.max(0, maxRoundsNeeded - 1),
      };
    }, {
      timeout: 30000, // 30 seconds timeout
    });

    return NextResponse.json({
      ok: true,
      stopId,
      overwrite,
      ...res,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to generate schedule' }, { status: 500 });
  }
}
