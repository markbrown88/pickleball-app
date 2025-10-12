import { PrismaClient, Prisma } from '@prisma/client';
import { mapLineupToEntries, playersForSlot } from './lineupSlots';

type LineupPlayer = {
  id: string;
  name: string;
  gender?: string;
};

type EnrichedLineup = LineupPlayer[];

type LineupEntryWithPlayers = {
  slot: string;
  player1: { id: string; name: string; gender?: string } | null;
  player2: { id: string; name: string; gender?: string } | null;
};

/**
 * Fetches lineup data from Lineup/LineupEntry tables for a given round and team
 * Returns data in the same format as the legacy JSON fields (array of 4 players)
 */
export async function getLineupForRoundAndTeam(
  prisma: PrismaClient | Prisma.TransactionClient,
  roundId: string,
  teamId: string
): Promise<EnrichedLineup | null> {
  const lineup = await prisma.lineup.findUnique({
    where: {
      roundId_teamId: { roundId, teamId },
    },
    include: {
      entries: {
        include: {
          player1: { select: { id: true, name: true, gender: true } },
          player2: { select: { id: true, name: true, gender: true } },
        },
      },
    },
  });

  if (!lineup || lineup.entries.length === 0) {
    return null;
  }

  // Reconstruct the 4-player array [Man1, Man2, Woman1, Woman2]
  return extractCoreLineupFromEntries(lineup.entries as any);
}

/**
 * Fetches lineups for a specific match (gets both team A and team B lineups)
 */
export async function getLineupsForMatch(
  prisma: PrismaClient | Prisma.TransactionClient,
  roundId: string,
  teamAId: string,
  teamBId: string
): Promise<{ teamALineup: EnrichedLineup | null; teamBLineup: EnrichedLineup | null }> {
  const [teamALineup, teamBLineup] = await Promise.all([
    getLineupForRoundAndTeam(prisma, roundId, teamAId),
    getLineupForRoundAndTeam(prisma, roundId, teamBId),
  ]);

  return { teamALineup, teamBLineup };
}

/**
 * Fetches lineups for all teams in a round
 */
export async function getLineupsForRound(
  prisma: PrismaClient | Prisma.TransactionClient,
  roundId: string
): Promise<Map<string, EnrichedLineup>> {
  const lineups = await prisma.lineup.findMany({
    where: { roundId },
    include: {
      entries: {
        include: {
          player1: { select: { id: true, name: true, gender: true } },
          player2: { select: { id: true, name: true, gender: true } },
        },
      },
    },
  });

  const lineupMap = new Map<string, EnrichedLineup>();

  for (const lineup of lineups) {
    const coreLineup = extractCoreLineupFromEntries(lineup.entries as any);
    if (coreLineup) {
      lineupMap.set(lineup.teamId, coreLineup);
    }
  }

  return lineupMap;
}

/**
 * Saves a lineup for a team in a specific round
 * Replaces any existing lineup data
 */
export async function saveLineupForRoundAndTeam(
  prisma: PrismaClient | Prisma.TransactionClient,
  roundId: string,
  teamId: string,
  stopId: string,
  players: { id: string }[]
): Promise<void> {
  if (players.length !== 4) {
    throw new Error('Lineup must contain exactly 4 players');
  }

  const entries = mapLineupToEntries(players);

  // Check if prisma is a TransactionClient or PrismaClient
  if ('$transaction' in prisma) {
    // It's a PrismaClient, use $transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing lineup
      await tx.lineup.deleteMany({
        where: { roundId, teamId },
      });

      // Create new lineup
      const newLineup = await tx.lineup.create({
        data: {
          roundId,
          teamId,
          stopId,
        },
      });

      // Create lineup entries
      await tx.lineupEntry.createMany({
        data: entries.map((entry) => ({
          lineupId: newLineup.id,
          slot: entry.slot as GameSlot,
          player1Id: entry.player1Id!,
          player2Id: entry.player2Id!,
        })),
      });
    });
  } else {
    // It's a TransactionClient, use it directly
    // Delete existing lineup
    await prisma.lineup.deleteMany({
      where: { roundId, teamId },
    });

    // Create new lineup
    const newLineup = await prisma.lineup.create({
      data: {
        roundId,
        teamId,
        stopId,
      },
    });

    // Create lineup entries
    await prisma.lineupEntry.createMany({
      data: entries.map((entry) => ({
        lineupId: newLineup.id,
        slot: entry.slot as GameSlot,
        player1Id: entry.player1Id!,
        player2Id: entry.player2Id!,
      })),
    });
  }
}

/**
 * Extracts the core 4-player lineup from LineupEntry records
 * Returns [Man1, Man2, Woman1, Woman2]
 */
function extractCoreLineupFromEntries(
  entries: LineupEntryWithPlayers[]
): EnrichedLineup | null {
  const mensDoubles = entries.find((e) => e.slot === 'MENS_DOUBLES');
  const womensDoubles = entries.find((e) => e.slot === 'WOMENS_DOUBLES');

  if (!mensDoubles?.player1 || !mensDoubles?.player2 || !womensDoubles?.player1 || !womensDoubles?.player2) {
    return null;
  }

  return [
    mensDoubles.player1,
    mensDoubles.player2,
    womensDoubles.player1,
    womensDoubles.player2,
  ];
}

/**
 * Gets the lineup for a specific game slot (e.g., MENS_DOUBLES, MIXED_1)
 * Returns the two players for that slot
 */
export function getPlayersForSlot(
  lineup: EnrichedLineup | null,
  slot: string
): [LineupPlayer | undefined, LineupPlayer | undefined] {
  if (!lineup || lineup.length !== 4) {
    return [undefined, undefined];
  }
  return [...playersForSlot(lineup, slot)] as [LineupPlayer | undefined, LineupPlayer | undefined];
}

/**
 * Checks if a lineup exists and is complete for a round and team
 */
export async function isLineupComplete(
  prisma: PrismaClient | Prisma.TransactionClient,
  roundId: string,
  teamId: string
): Promise<boolean> {
  const lineup = await prisma.lineup.findUnique({
    where: {
      roundId_teamId: { roundId, teamId },
    },
    include: {
      entries: true,
    },
  });

  return lineup !== null && lineup.entries.length === 4;
}

/**
 * Gets all games with their lineups for a specific round
 * Used for display purposes (replaces loading from Game.teamALineup/teamBLineup)
 */
export async function getGamesWithLineups(
  prisma: PrismaClient | Prisma.TransactionClient,
  roundId: string
) {
  const games = await prisma.game.findMany({
    where: {
      match: { roundId },
    },
    include: {
      match: {
        include: {
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [
      { match: { id: 'asc' } },
      { id: 'asc' },
    ],
  });

  // Get all lineups for this round
  const lineupMap = await getLineupsForRound(prisma, roundId);

  // Enrich games with lineup data
  return games.map((game) => {
    const teamALineup = lineupMap.get(game.match?.teamA?.id) || null;
    const teamBLineup = lineupMap.get(game.match?.teamB?.id) || null;

    return {
      ...game,
      teamALineup,
      teamBLineup,
    };
  });
}

/**
 * Deletes a lineup for a specific round and team
 */
export async function deleteLineup(
  prisma: PrismaClient | Prisma.TransactionClient,
  roundId: string,
  teamId: string
): Promise<void> {
  await prisma.lineup.deleteMany({
    where: { roundId, teamId },
  });
}
