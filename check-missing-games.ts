import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Missing Games for Blue Zone vs 4 Fathers ===\n');

  const matchId = 'cmgdy7p99003rr0k8kcvzmlwx';

  // Get all games for this match
  const allGames = await prisma.game.findMany({
    where: { matchId },
    select: {
      id: true,
      slot: true,
      teamAScore: true,
      teamBScore: true,
      isComplete: true,
      teamALineup: true,
      teamBLineup: true,
      lineupConfirmed: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Total games found: ${allGames.length}`);
  allGames.forEach((game, index) => {
    console.log(`  ${index + 1}. ${game.slot} (${game.id}) - Created: ${game.createdAt}`);
  });

  // Check what games should exist
  const expectedSlots = ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2', 'TIEBREAKER'];
  const existingSlots = allGames.map(g => g.slot);
  
  console.log('\nExpected games:');
  expectedSlots.forEach(slot => {
    const exists = existingSlots.includes(slot);
    console.log(`  ${slot}: ${exists ? '✅ Exists' : '❌ Missing'}`);
  });

  // Check if this match was created properly
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      isBye: true,
      createdAt: true,
      teamA: { select: { name: true } },
      teamB: { select: { name: true } }
    }
  });

  console.log('\nMatch details:');
  console.log(`  Teams: ${match?.teamA?.name} vs ${match?.teamB?.name}`);
  console.log(`  Is BYE: ${match?.isBye}`);
  console.log(`  Created: ${match?.createdAt}`);

  // Check if there are any deleted games (this would be in the database logs)
  console.log('\nThis match appears to be missing 4 of its 5 expected games.');
  console.log('This could happen if:');
  console.log('1. The match was created incorrectly');
  console.log('2. The games were deleted after creation');
  console.log('3. There was an error during game creation');
}

main().catch(console.error).finally(() => prisma.$disconnect());
