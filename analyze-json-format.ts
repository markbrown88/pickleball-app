import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeJsonFormat() {
  try {
    // Get sample games for each slot type to understand the JSON format
    const slots = ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'];

    console.log('Analyzing JSON lineup format for each game slot:\n');

    for (const slot of slots) {
      const game = await prisma.game.findFirst({
        where: {
          slot: slot as any,
          teamALineup: { not: Prisma.JsonNull }
        },
        select: {
          id: true,
          slot: true,
          teamALineup: true,
          teamBLineup: true,
          match: {
            select: {
              id: true,
              roundId: true,
              teamAId: true,
              teamBId: true,
              teamA: { select: { name: true } },
              teamB: { select: { name: true } }
            }
          }
        }
      });

      if (!game) {
        console.log(`${slot}: No data found\n`);
        continue;
      }

      console.log(`${slot}:`);
      console.log(`  Match: ${game.match.teamA?.name} vs ${game.match.teamB?.name}`);
      console.log(`  TeamA JSON:`, JSON.stringify(game.teamALineup, null, 2));
      console.log(`  TeamB JSON:`, JSON.stringify(game.teamBLineup, null, 2));
      console.log('');
    }

    // Check if player IDs in JSON are valid
    console.log('Checking if player IDs in JSON are valid...\n');

    const gameWithPlayers = await prisma.game.findFirst({
      where: { teamALineup: { not: Prisma.JsonNull } },
      select: { teamALineup: true }
    });

    if (gameWithPlayers?.teamALineup) {
      const lineup = gameWithPlayers.teamALineup as any;
      if (Array.isArray(lineup) && lineup.length > 0) {
        const firstEntry = lineup[0];
        if (firstEntry.player1Id) {
          const player = await prisma.player.findUnique({
            where: { id: firstEntry.player1Id },
            select: { id: true, name: true, gender: true }
          });
          console.log('Sample player lookup:');
          console.log(`  ID: ${firstEntry.player1Id}`);
          console.log(`  Found: ${player ? `${player.name} (${player.gender})` : 'NOT FOUND'}`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeJsonFormat();
