import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Finding ALL Pickleplex Barrie vs One Health matches ===\n');

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

  // Find ALL matches between Pickleplex Barrie and One Health
  const matches = await prisma.match.findMany({
    where: {
      round: {
        stop: {
          tournamentId: tournament.id
        }
      },
      OR: [
        {
          teamA: { name: { contains: 'Pickleplex Barrie' } },
          teamB: { name: { contains: 'One Health' } }
        },
        {
          teamA: { name: { contains: 'One Health' } },
          teamB: { name: { contains: 'Pickleplex Barrie' } }
        }
      ]
    },
    include: {
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
      round: {
        include: {
          stop: { select: { name: true } }
        }
      },
      games: {
        select: { 
          id: true, 
          slot: true, 
          teamAScore: true, 
          teamBScore: true, 
          isComplete: true 
        }
      }
    },
    orderBy: [
      { round: { stop: { createdAt: 'asc' } } },
      { round: { idx: 'asc' } }
    ]
  });

  console.log(`Found ${matches.length} matches between Pickleplex Barrie and One Health:\n`);

  matches.forEach((match, index) => {
    console.log(`=== Match ${index + 1} ===`);
    console.log(`Teams: ${match.teamA?.name} vs ${match.teamB?.name}`);
    console.log(`Stop: ${match.round.stop.name}`);
    console.log(`Round: ${match.round.idx + 1}`);
    console.log(`Match ID: ${match.id}`);
    console.log(`Games (${match.games.length}):`);
    
    match.games.forEach((game, gameIndex) => {
      console.log(`  ${gameIndex + 1}. ${game.slot}:`);
      console.log(`     Team A: ${game.teamAScore}, Team B: ${game.teamBScore}`);
      console.log(`     Complete: ${game.isComplete}`);
    });

    // Check tiebreaker logic for this match
    const completedGames = match.games.filter(g => g.slot !== 'TIEBREAKER' && g.isComplete);
    const teamAWins = completedGames.filter(g => g.teamAScore && g.teamBScore && g.teamAScore > g.teamBScore).length;
    const teamBWins = completedGames.filter(g => g.teamAScore && g.teamBScore && g.teamBScore > g.teamAScore).length;
    const needsTiebreaker = completedGames.length === 4 && teamAWins === 2 && teamBWins === 2;
    const hasTiebreaker = match.games.find(g => g.slot === 'TIEBREAKER');

    console.log(`\nTiebreaker Analysis:`);
    console.log(`  Completed games: ${completedGames.length}/4`);
    console.log(`  Team A wins: ${teamAWins}`);
    console.log(`  Team B wins: ${teamBWins}`);
    console.log(`  Needs tiebreaker: ${needsTiebreaker}`);
    console.log(`  Has tiebreaker: ${hasTiebreaker ? 'Yes' : 'No'}`);
    
    if (needsTiebreaker && hasTiebreaker) {
      console.log(`  ✅ Should show tiebreaker section`);
    } else if (needsTiebreaker && !hasTiebreaker) {
      console.log(`  ❌ Needs tiebreaker but no tiebreaker game exists`);
    } else if (!needsTiebreaker && hasTiebreaker) {
      console.log(`  ⚠️  Has tiebreaker game but no tiebreaker needed`);
    } else {
      console.log(`  ℹ️  No tiebreaker needed or available`);
    }

    console.log('\n' + '='.repeat(50) + '\n');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
