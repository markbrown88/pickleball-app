import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Verifying Pickleplex Barrie vs One Health Match ===\n');

  // Find the specific match
  const match = await prisma.match.findFirst({
    where: {
      teamA: { name: { contains: 'Pickleplex Barrie Advanced' } },
      teamB: { name: { contains: 'One Health Advanced' } },
      round: {
        stop: {
          tournament: {
            name: { contains: 'Klyng' },
            NOT: { name: { contains: 'pickleplex' } }
          }
        }
      }
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
        },
        orderBy: { slot: 'asc' }
      }
    }
  });

  if (!match) {
    console.log('❌ Match not found');
    return;
  }

  console.log(`✅ Match found: ${match.teamA?.name} vs ${match.teamB?.name}`);
  console.log(`Stop: ${match.round.stop.name}`);
  console.log(`Match ID: ${match.id}\n`);

  console.log('Games in this match:');
  match.games.forEach((game, index) => {
    console.log(`  ${index + 1}. ${game.slot}:`);
    console.log(`     Team A Score: ${game.teamAScore}`);
    console.log(`     Team B Score: ${game.teamBScore}`);
    console.log(`     Complete: ${game.isComplete}`);
  });

  // Check tiebreaker logic
  console.log('\n=== Tiebreaker Analysis ===');
  const completedGames = match.games.filter(g => g.slot !== 'TIEBREAKER' && g.isComplete);
  const teamAWins = completedGames.filter(g => g.teamAScore && g.teamBScore && g.teamAScore > g.teamBScore).length;
  const teamBWins = completedGames.filter(g => g.teamAScore && g.teamBScore && g.teamBScore > g.teamAScore).length;
  const needsTiebreaker = completedGames.length === 4 && teamAWins === 2 && teamBWins === 2;
  const hasTiebreaker = match.games.find(g => g.slot === 'TIEBREAKER');

  console.log(`Completed games (excluding tiebreaker): ${completedGames.length}/4`);
  console.log(`Team A wins: ${teamAWins}`);
  console.log(`Team B wins: ${teamBWins}`);
  console.log(`Needs tiebreaker: ${needsTiebreaker}`);
  console.log(`Has tiebreaker game: ${hasTiebreaker ? 'Yes' : 'No'}`);
  
  if (hasTiebreaker) {
    console.log(`Tiebreaker game ID: ${hasTiebreaker.id}`);
    console.log(`Tiebreaker complete: ${hasTiebreaker.isComplete}`);
  }

  console.log('\n=== Summary ===');
  if (needsTiebreaker && hasTiebreaker) {
    console.log('✅ Should now show tiebreaker section in the UI!');
  } else if (needsTiebreaker && !hasTiebreaker) {
    console.log('❌ Still needs tiebreaker but no tiebreaker game exists');
  } else if (!needsTiebreaker && hasTiebreaker) {
    console.log('ℹ️  Has tiebreaker game but no tiebreaker needed (not tied 2-2)');
  } else {
    console.log('ℹ️  No tiebreaker needed or available');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
