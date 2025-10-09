import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Creating Missing Games for Blue Zone vs 4 Fathers ===\n');

  const matchId = 'cmgdy7p99003rr0k8kcvzmlwx';

  // Check current games
  const currentGames = await prisma.game.findMany({
    where: { matchId },
    select: { slot: true }
  });

  const existingSlots = currentGames.map(g => g.slot);
  console.log(`Current games: ${existingSlots.join(', ')}`);

  // Create missing games
  const expectedSlots = ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'];
  const missingSlots = expectedSlots.filter(slot => !existingSlots.includes(slot));

  console.log(`Missing games: ${missingSlots.join(', ')}`);

  if (missingSlots.length === 0) {
    console.log('✅ All games already exist!');
    return;
  }

  // Create the missing games
  const gamesToCreate = missingSlots.map(slot => ({
    matchId,
    slot,
    teamAScore: null,
    teamBScore: null,
    teamALineup: null,
    teamBLineup: null,
    lineupConfirmed: false,
    isComplete: false
  }));

  try {
    const result = await prisma.game.createMany({
      data: gamesToCreate,
      skipDuplicates: true
    });

    console.log(`✅ Successfully created ${result.count} missing games!\n`);

    // Verify the creation
    const updatedGames = await prisma.game.findMany({
      where: { matchId },
      select: { slot: true },
      orderBy: { slot: 'asc' }
    });

    console.log('Updated games:');
    updatedGames.forEach((game, index) => {
      console.log(`  ${index + 1}. ${game.slot}`);
    });

    console.log('\n✅ The lineup selection should now work!');
    console.log('You should now be able to select players for all 4 main games.');

  } catch (error) {
    console.error('❌ Error creating missing games:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
