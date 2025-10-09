import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Reverting Forfeit Game Changes ===\n');
  console.log('Removing WINNER/FORFEIT indicators from games\n');

  // Find both forfeit matches
  const forfeitMatches = await prisma.match.findMany({
    where: {
      round: { stop: { name: 'Stop 2' } },
      forfeitTeam: { not: null }
    },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      round: { 
        select: { 
          idx: true,
          stop: { select: { name: true } }
        } 
      },
      games: {
        where: {
          slot: { in: ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'] }
        },
        select: {
          id: true,
          slot: true,
          teamAScore: true,
          teamBScore: true,
          isComplete: true
        }
      }
    },
    orderBy: { round: { idx: 'asc' } }
  });

  console.log(`Found ${forfeitMatches.length} forfeit matches to revert\n`);

  for (const match of forfeitMatches) {
    console.log(`=== ${match.teamA?.name} vs ${match.teamB?.name} (Round ${match.round.idx + 1}) ===`);
    console.log(`Forfeit team: ${match.forfeitTeam}`);

    // Revert each game to have null lineups (as it should be for forfeits)
    for (const game of match.games) {
      await prisma.game.update({
        where: { id: game.id },
        data: {
          teamALineup: null, // No lineups for forfeit
          teamBLineup: null  // No lineups for forfeit
        }
      });

      console.log(`  Reverted ${game.slot}: ${game.teamAScore} - ${game.teamBScore} (lineups: null)`);
    }

    console.log(`✅ Reverted ${match.games.length} games to have null lineups\n`);
  }

  console.log('=== SUMMARY ===');
  console.log('✅ Removed WINNER/FORFEIT indicators from games');
  console.log('✅ Games now have null lineups (as they should for forfeits)');
  console.log('✅ Forfeit display should be handled by the match card UI');
  console.log('\nThe forfeit indicator (FF and "Team X wins by forfeit") should be:');
  console.log('- Displayed on the match card itself');
  console.log('- Not in the individual games');
  console.log('- Based on the forfeitTeam field and team names');
}

main().catch(console.error).finally(() => prisma.$disconnect());
