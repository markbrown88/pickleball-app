import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Verifying Schedule Creation Pattern ===\n');

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

  // Check all stops and their game creation patterns
  const stops = await prisma.stop.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, createdAt: true }
  });

  for (const stop of stops) {
    console.log(`=== ${stop.name} ===`);
    
    // Get a sample of matches from this stop
    const sampleMatches = await prisma.match.findMany({
      where: {
        round: { stopId: stop.id },
        isBye: false
      },
      take: 3, // Sample 3 matches
      include: {
        teamA: { select: { name: true } },
        teamB: { select: { name: true } },
        games: {
          select: { slot: true },
          orderBy: { slot: 'asc' }
        }
      }
    });

    console.log(`Sample matches (${sampleMatches.length}):`);
    
    let allHaveTiebreaker = true;
    let gameCounts: number[] = [];
    
    sampleMatches.forEach((match, index) => {
      const gameSlots = match.games.map(g => g.slot);
      const hasTiebreaker = gameSlots.includes('TIEBREAKER');
      const gameCount = gameSlots.length;
      
      gameCounts.push(gameCount);
      if (!hasTiebreaker) allHaveTiebreaker = false;
      
      console.log(`  ${index + 1}. ${match.teamA?.name} vs ${match.teamB?.name}:`);
      console.log(`     Games: ${gameSlots.join(', ')} (${gameCount} total)`);
      console.log(`     Has TIEBREAKER: ${hasTiebreaker ? 'Yes' : 'No'}`);
    });

    // Summary for this stop
    const avgGameCount = gameCounts.reduce((a, b) => a + b, 0) / gameCounts.length;
    console.log(`\nStop Summary:`);
    console.log(`  Average games per match: ${avgGameCount.toFixed(1)}`);
    console.log(`  All matches have tiebreaker: ${allHaveTiebreaker ? 'Yes' : 'No'}`);
    console.log(`  Expected: 5 games per match (including TIEBREAKER)`);
    
    if (avgGameCount === 5 && allHaveTiebreaker) {
      console.log(`  ✅ Stop follows expected pattern`);
    } else {
      console.log(`  ❌ Stop does NOT follow expected pattern`);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
  }

  // Overall summary
  console.log('=== Overall Pattern Analysis ===');
  console.log('Expected: Every match should have 5 games:');
  console.log('  1. MENS_DOUBLES');
  console.log('  2. WOMENS_DOUBLES'); 
  console.log('  3. MIXED_1');
  console.log('  4. MIXED_2');
  console.log('  5. TIEBREAKER');
  console.log('\nThe TIEBREAKER game is created upfront but only shown in the UI when:');
  console.log('- 4 main games are completed AND');
  console.log('- Teams are tied 2-2');
}

main().catch(console.error).finally(() => prisma.$disconnect());
