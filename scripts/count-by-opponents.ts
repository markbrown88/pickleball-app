import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function countByOpponents() {
  const monica = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Monica', mode: 'insensitive' }, lastName: { contains: 'Lin', mode: 'insensitive' } },
        { name: { contains: 'Monica Lin', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  const sharon = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Sharon', mode: 'insensitive' }, lastName: { contains: 'Scarfone', mode: 'insensitive' } },
        { name: { contains: 'Sharon Scarfone', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  const tournament = await prisma.tournament.findFirst({
    where: {
      name: { equals: 'KLYNG CUP - GRAND FINALE' },
    },
    select: { id: true },
  });

  if (!monica || !sharon || !tournament) return;

  const allMixedGames = await prisma.game.findMany({
    where: {
      match: {
        round: {
          stop: {
            tournamentId: tournament.id,
          },
        },
      },
      OR: [
        { slot: 'MIXED_1' },
        { slot: 'MIXED_2' },
      ],
    },
    include: {
      match: {
        include: {
          round: { select: { id: true, idx: true, bracketType: true } },
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } },
        },
      },
      bracket: { select: { name: true } },
    },
  });

  const allLineups = await prisma.lineupEntry.findMany({
    where: {
      lineup: {
        round: {
          stop: {
            tournamentId: tournament.id,
          },
        },
      },
      OR: [
        { player1Id: monica.id },
        { player2Id: monica.id },
        { player1Id: sharon.id },
        { player2Id: sharon.id },
      ],
    },
    include: {
      lineup: {
        include: {
          round: { select: { id: true, idx: true } },
          team: { select: { id: true, name: true } },
        },
      },
      player1: { select: { name: true, firstName: true, lastName: true } },
      player2: { select: { name: true, firstName: true, lastName: true } },
    },
  });

  // Count by unique opponents (not matches)
  const monicaOpponents = new Set<string>();
  const sharonOpponents = new Set<string>();

  for (const game of allMixedGames) {
    const roundId = game.match.round.id;
    const slot = game.slot;
    const relevantLineups = allLineups.filter(
      le => le.lineup.roundId === roundId && le.slot === slot
    );

    for (const entry of relevantLineups) {
      const match = game.match;
      const theirTeam = entry.lineup.team;
      const opponentTeam = match.teamAId === theirTeam.id ? match.teamB : match.teamA;
      const opponent = opponentTeam?.name || 'TBD';

      if (entry.player1Id === monica.id || entry.player2Id === monica.id) {
        monicaOpponents.add(opponent);
      }
      if (entry.player1Id === sharon.id || entry.player2Id === sharon.id) {
        sharonOpponents.add(opponent);
      }
    }
  }

  console.log(`\nMonica unique opponents: ${monicaOpponents.size}`);
  console.log(`Opponents: ${Array.from(monicaOpponents).sort().join(', ')}`);
  
  console.log(`\nSharon unique opponents: ${sharonOpponents.size}`);
  console.log(`Opponents: ${Array.from(sharonOpponents).sort().join(', ')}`);

  // Also show by round
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('GAMES BY ROUND');
  console.log('='.repeat(80));

  const monicaByRound = new Map<number, Array<{ opponent: string; slot: string }>>();
  const sharonByRound = new Map<number, Array<{ opponent: string; slot: string }>>();

  for (const game of allMixedGames) {
    const roundId = game.match.round.id;
    const slot = game.slot;
    const relevantLineups = allLineups.filter(
      le => le.lineup.roundId === roundId && le.slot === slot
    );

    for (const entry of relevantLineups) {
      const match = game.match;
      const theirTeam = entry.lineup.team;
      const opponentTeam = match.teamAId === theirTeam.id ? match.teamB : match.teamA;
      const opponent = opponentTeam?.name || 'TBD';
      const roundIdx = game.match.round.idx;

      if (entry.player1Id === monica.id || entry.player2Id === monica.id) {
        if (!monicaByRound.has(roundIdx)) {
          monicaByRound.set(roundIdx, []);
        }
        monicaByRound.get(roundIdx)!.push({ opponent, slot });
      }
      if (entry.player1Id === sharon.id || entry.player2Id === sharon.id) {
        if (!sharonByRound.has(roundIdx)) {
          sharonByRound.set(roundIdx, []);
        }
        sharonByRound.get(roundIdx)!.push({ opponent, slot });
      }
    }
  }

  console.log(`\nMonica games by round:`);
  for (const [roundIdx, games] of Array.from(monicaByRound.entries()).sort()) {
    const uniqueOpponents = new Set(games.map(g => g.opponent));
    console.log(`  Round ${roundIdx}: ${games.length} games, ${uniqueOpponents.size} unique opponents (${Array.from(uniqueOpponents).join(', ')})`);
  }

  console.log(`\nSharon games by round:`);
  for (const [roundIdx, games] of Array.from(sharonByRound.entries()).sort()) {
    const uniqueOpponents = new Set(games.map(g => g.opponent));
    console.log(`  Round ${roundIdx}: ${games.length} games, ${uniqueOpponents.size} unique opponents (${Array.from(uniqueOpponents).join(', ')})`);
  }
}

countByOpponents()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

