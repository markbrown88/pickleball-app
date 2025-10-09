import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Round 6 Matches ===\n');

  // Get all Round 6 matches in Stop 2
  const round6 = await prisma.round.findFirst({
    where: {
      stop: { name: 'Stop 2' },
      idx: 5 // Round 6 (0-based index)
    },
    include: {
      matches: {
        include: {
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } },
          games: {
            where: { slot: { not: 'TIEBREAKER' } },
            select: {
              id: true,
              slot: true,
              teamALineup: true,
              teamBLineup: true
            },
            orderBy: { slot: 'asc' }
          }
        }
      }
    }
  });

  if (!round6) {
    console.log('❌ Round 6 not found');
    return;
  }

  console.log(`Round 6 has ${round6.matches.length} matches:\n`);

  for (const match of round6.matches) {
    console.log(`Match: ${match.teamA?.name} vs ${match.teamB?.name}`);
    console.log(`Match ID: ${match.id}`);
    
    for (const game of match.games) {
      console.log(`  ${game.slot}:`);
      if (game.teamALineup && Array.isArray(game.teamALineup) && game.teamALineup.length > 0) {
        const teamA = game.teamALineup[0];
        console.log(`    Team A: ${teamA.player1Id} + ${teamA.player2Id}`);
      } else {
        console.log(`    Team A: No lineup`);
      }
      if (game.teamBLineup && Array.isArray(game.teamBLineup) && game.teamBLineup.length > 0) {
        const teamB = game.teamBLineup[0];
        console.log(`    Team B: ${teamB.player1Id} + ${teamB.player2Id}`);
      } else {
        console.log(`    Team B: No lineup`);
      }
    }
    console.log('');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
