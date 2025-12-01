import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function findAllGames() {
  const monica = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Monica', mode: 'insensitive' }, lastName: { contains: 'Lin', mode: 'insensitive' } },
        { name: { contains: 'Monica Lin', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  const sharon = await prisma.player.findFirst({
    where: {
      OR: [
        { firstName: { contains: 'Sharon', mode: 'insensitive' }, lastName: { contains: 'Scarfone', mode: 'insensitive' } },
        { name: { contains: 'Sharon Scarfone', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  // Get exact tournament
  const tournament = await prisma.tournament.findFirst({
    where: {
      name: {
        equals: 'KLYNG CUP - GRAND FINALE',
      },
    },
    select: { id: true, name: true },
  });

  if (!monica || !sharon || !tournament) {
    console.log('Not found');
    return;
  }

  console.log(`\nTournament: "${tournament.name}"\n`);

  // Get ALL MIXED games in this tournament
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
          round: {
            include: {
              stop: { select: { name: true } },
            },
          },
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } },
        },
      },
      bracket: { select: { name: true } },
    },
    orderBy: [
      { match: { round: { idx: 'asc' } } },
      { slot: 'asc' },
    ],
  });

  // Get ALL lineup entries for this tournament
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
          round: { select: { id: true, idx: true, bracketType: true } },
          team: { select: { id: true, name: true } },
        },
      },
      player1: { select: { name: true, firstName: true, lastName: true } },
      player2: { select: { name: true, firstName: true, lastName: true } },
    },
  });

  console.log(`Total MIXED games in tournament: ${allMixedGames.length}`);
  console.log(`Total lineup entries for Monica/Sharon: ${allLineups.length}\n`);

  // For each game, find if Monica or Sharon played
  const monicaGames: Array<{
    game: typeof allMixedGames[0];
    entry: typeof allLineups[0];
    opponent: string;
  }> = [];

  const sharonGames: Array<{
    game: typeof allMixedGames[0];
    entry: typeof allLineups[0];
    opponent: string;
  }> = [];

  for (const game of allMixedGames) {
    const roundId = game.match.round.id;
    const slot = game.slot;

    // Find lineup entries for this round and slot
    const relevantLineups = allLineups.filter(
      le => le.lineup.roundId === roundId && le.slot === slot
    );

    for (const entry of relevantLineups) {
      const match = game.match;
      const theirTeam = entry.lineup.team;
      const opponentTeam = match.teamAId === theirTeam.id ? match.teamB : match.teamA;

      if (entry.player1Id === monica.id || entry.player2Id === monica.id) {
        monicaGames.push({
          game,
          entry,
          opponent: opponentTeam?.name || 'TBD',
        });
      }

      if (entry.player1Id === sharon.id || entry.player2Id === sharon.id) {
        sharonGames.push({
          game,
          entry,
          opponent: opponentTeam?.name || 'TBD',
        });
      }
    }
  }

  // Group by unique match (round + opponent + slot)
  const monicaUnique = new Map<string, typeof monicaGames[0]>();
  for (const item of monicaGames) {
    const key = `${item.game.match.round.idx}-${item.opponent}-${item.entry.slot}`;
    if (!monicaUnique.has(key)) {
      monicaUnique.set(key, item);
    }
  }

  const sharonUnique = new Map<string, typeof sharonGames[0]>();
  for (const item of sharonGames) {
    const key = `${item.game.match.round.idx}-${item.opponent}-${item.entry.slot}`;
    if (!sharonUnique.has(key)) {
      sharonUnique.set(key, item);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('MONICA LIN - ALL MIXED GAMES');
  console.log('='.repeat(80));
  console.log(`Total games found: ${monicaGames.length}`);
  console.log(`Unique matches: ${monicaUnique.size}\n`);

  let count = 0;
  for (const [key, item] of Array.from(monicaUnique.entries()).sort()) {
    count++;
    const partner = item.entry.player1Id === monica.id ? item.entry.player2 : item.entry.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`${count}. Round ${item.game.match.round.idx} (${item.game.match.round.bracketType || 'UNKNOWN'}) - ${item.entry.slot}`);
    console.log(`   Opponent: ${item.opponent}`);
    console.log(`   Partner: ${partnerName}`);
    console.log(`   Bracket: ${item.game.bracket?.name || 'No Bracket'}`);
    console.log(`   Game ID: ${item.game.id}`);
    console.log(`   Match ID: ${item.game.matchId}`);
    console.log(`   Lineup Entry ID: ${item.entry.id}`);
    console.log();
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('SHARON SCARFONE - ALL MIXED GAMES');
  console.log('='.repeat(80));
  console.log(`Total games found: ${sharonGames.length}`);
  console.log(`Unique matches: ${sharonUnique.size}\n`);

  count = 0;
  for (const [key, item] of Array.from(sharonUnique.entries()).sort()) {
    count++;
    const partner = item.entry.player1Id === sharon.id ? item.entry.player2 : item.entry.player1;
    const partnerName = partner?.name || `${partner?.firstName} ${partner?.lastName}` || 'Unknown';
    console.log(`${count}. Round ${item.game.match.round.idx} (${item.game.match.round.bracketType || 'UNKNOWN'}) - ${item.entry.slot}`);
    console.log(`   Opponent: ${item.opponent}`);
    console.log(`   Partner: ${partnerName}`);
    console.log(`   Bracket: ${item.game.bracket?.name || 'No Bracket'}`);
    console.log(`   Game ID: ${item.game.id}`);
    console.log(`   Match ID: ${item.game.matchId}`);
    console.log(`   Lineup Entry ID: ${item.entry.id}`);
    console.log();
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Monica unique matches: ${monicaUnique.size}`);
  console.log(`Sharon unique matches: ${sharonUnique.size}`);
}

findAllGames()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

