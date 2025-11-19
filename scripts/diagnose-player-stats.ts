import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const playerEmail = process.argv[2] || 'lourdesvillamor@gmail.com';

async function diagnose() {
  console.log(`\n=== Diagnosing stats for ${playerEmail} ===\n`);

  // Find player
  const player = await prisma.player.findFirst({
    where: { email: playerEmail }
  });

  if (!player) {
    console.log('❌ Player not found');
    return;
  }

  console.log(`✅ Player found: ${player.firstName} ${player.lastName} (${player.id})`);

  // Check lineup entries
  const lineupEntries = await prisma.lineupEntry.findMany({
    where: {
      OR: [
        { player1Id: player.id },
        { player2Id: player.id }
      ]
    },
    include: {
      lineup: {
        include: {
          team: true,
          round: {
            include: {
              stop: {
                include: {
                  tournament: {
                    select: {
                      name: true,
                      gamesPerMatch: true
                    }
                  }
                }
              },
              matches: {
                include: {
                  games: true
                }
              }
            }
          }
        }
      }
    }
  });

  console.log(`\n📋 Found ${lineupEntries.length} lineup entries`);

  if (lineupEntries.length === 0) {
    console.log('❌ No lineup entries found - player has not been assigned to any lineups');
    return;
  }

  let totalGamesFound = 0;
  let totalMatchingSlotGames = 0;
  let completeGames = 0;

  for (const entry of lineupEntries) {
    const { lineup, slot } = entry;
    const { team, round } = lineup;

    console.log(`\n--- Lineup Entry ---`);
    console.log(`  Tournament: ${round.stop.tournament.name}`);
    console.log(`  Team: ${team.name}`);
    console.log(`  Slot: ${slot}`);
    console.log(`  Round has ${round.matches.length} matches`);

    for (const match of round.matches) {
      // Check if this team is in the match
      if (match.teamAId !== team.id && match.teamBId !== team.id) {
        continue;
      }

      console.log(`\n  Match ${match.id}:`);
      console.log(`    Total games in match: ${match.games.length}`);

      const allGameSlots = match.games.map(g => g.slot).join(', ');
      console.log(`    Game slots: ${allGameSlots || '(none)'}`);

      totalGamesFound += match.games.length;

      const matchingSlotGames = match.games.filter(g => g.slot === slot);
      totalMatchingSlotGames += matchingSlotGames.length;

      console.log(`    Games matching slot "${slot}": ${matchingSlotGames.length}`);

      for (const game of matchingSlotGames) {
        console.log(`      Game ${game.id}: ${game.isComplete ? '✅ Complete' : '⏳ Incomplete'} - Score: ${game.teamAScore}-${game.teamBScore}`);
        if (game.isComplete && game.teamAScore !== null && game.teamBScore !== null) {
          completeGames++;
        }
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total games in matches: ${totalGamesFound}`);
  console.log(`Games matching player's slot: ${totalMatchingSlotGames}`);
  console.log(`Complete games with scores: ${completeGames}`);

  if (totalGamesFound > 0 && totalMatchingSlotGames === 0) {
    console.log(`\n❌ ISSUE: Player has games in their matches but NONE match their assigned slot!`);
    console.log(`   This means the lineup entry slots don't match the game slots.`);
  }

  await prisma.$disconnect();
}

diagnose().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
