import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Adding Missing TIEBREAKER Games to Stop 2 ===\n');

  // Find the tournament
  const tournament = await prisma.tournament.findFirst({
    where: { 
      name: { contains: 'Klyng' },
      NOT: { name: { contains: 'pickleplex' } }
    }
  });

  if (!tournament) {
    console.log('❌ Tournament not found');
    return;
  }

  console.log(`✅ Tournament: ${tournament.name} (${tournament.id})\n`);

  // Find Stop 2
  const stops = await prisma.stop.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true }
  });

  if (stops.length < 2) {
    console.log('❌ Stop 2 not found');
    return;
  }

  const stop2 = stops[1]; // Second stop (index 1)
  console.log(`✅ Stop 2: ${stop2.name} (${stop2.id})\n`);

  // Find all matches in Stop 2 that don't have tiebreaker games
  const matchesWithoutTiebreakers = await prisma.match.findMany({
    where: {
      round: { stopId: stop2.id },
      isBye: false,
      games: {
        none: {
          slot: 'TIEBREAKER'
        }
      }
    },
    include: {
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
      games: {
        select: { slot: true }
      }
    }
  });

  console.log(`Found ${matchesWithoutTiebreakers.length} matches without tiebreaker games:\n`);

  matchesWithoutTiebreakers.forEach((match, index) => {
    const gameSlots = match.games.map(g => g.slot).sort();
    console.log(`  ${index + 1}. ${match.teamA?.name} vs ${match.teamB?.name}`);
    console.log(`     Current games: ${gameSlots.join(', ')} (${gameSlots.length} total)`);
  });

  if (matchesWithoutTiebreakers.length === 0) {
    console.log('✅ All matches already have tiebreaker games!');
    return;
  }

  console.log(`\nCreating tiebreaker games for ${matchesWithoutTiebreakers.length} matches...\n`);

  // Create tiebreaker games for all matches
  const tiebreakerGames = matchesWithoutTiebreakers.map(match => ({
    matchId: match.id,
    slot: 'TIEBREAKER' as const,
    teamAScore: null,
    teamBScore: null,
    teamALineup: Prisma.JsonNull,
    teamBLineup: Prisma.JsonNull,
    lineupConfirmed: false,
    isComplete: false
  }));

  try {
    const result = await prisma.game.createMany({
      data: tiebreakerGames,
      skipDuplicates: true
    });

    console.log(`✅ Successfully created ${result.count} tiebreaker games!\n`);

    // Verify the creation
    console.log('Verification - checking a few matches:');
    const sampleMatches = matchesWithoutTiebreakers.slice(0, 3);
    
    for (const match of sampleMatches) {
      const updatedMatch = await prisma.match.findUnique({
        where: { id: match.id },
        include: {
          games: {
            select: { slot: true },
            orderBy: { slot: 'asc' }
          }
        }
      });

      if (updatedMatch) {
        const gameSlots = updatedMatch.games.map(g => g.slot);
        const hasTiebreaker = gameSlots.includes('TIEBREAKER');
        console.log(`  ${match.teamA?.name} vs ${match.teamB?.name}:`);
        console.log(`    Games: ${gameSlots.join(', ')} (${gameSlots.length} total)`);
        console.log(`    Has TIEBREAKER: ${hasTiebreaker ? 'Yes' : 'No'}`);
      }
    }

    console.log('\n✅ All matches in Stop 2 now have tiebreaker games!');
    console.log('The tiebreaker section should now appear in the UI when matches are tied 2-2.');

  } catch (error) {
    console.error('❌ Error creating tiebreaker games:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
