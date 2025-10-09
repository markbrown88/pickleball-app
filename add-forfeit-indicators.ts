import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Adding Forfeit Indicators to Games ===\n');

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

  console.log(`Found ${forfeitMatches.length} forfeit matches to update\n`);

  for (const match of forfeitMatches) {
    console.log(`=== ${match.teamA?.name} vs ${match.teamB?.name} (Round ${match.round.idx + 1}) ===`);
    console.log(`Forfeit team: ${match.forfeitTeam}`);
    
    // Determine winning team
    const winningTeam = match.forfeitTeam === 'A' ? match.teamB : match.teamA;
    const forfeitingTeam = match.forfeitTeam === 'A' ? match.teamA : match.teamB;
    
    console.log(`Winning team: ${winningTeam?.name}`);
    console.log(`Forfeiting team: ${forfeitingTeam?.name}`);

    // Update each game to include forfeit indicator in the lineup
    for (const game of match.games) {
      // Create forfeit indicator lineups
      const teamALineup = match.forfeitTeam === 'A' 
        ? [{ player1Id: 'FORFEIT', player2Id: 'FORFEIT' }] // Forfeiting team
        : [{ player1Id: 'WINNER', player2Id: 'WINNER' }];  // Winning team
      
      const teamBLineup = match.forfeitTeam === 'B' 
        ? [{ player1Id: 'FORFEIT', player2Id: 'FORFEIT' }] // Forfeiting team
        : [{ player1Id: 'WINNER', player2Id: 'WINNER' }];  // Winning team

      await prisma.game.update({
        where: { id: game.id },
        data: {
          teamALineup: teamALineup,
          teamBLineup: teamBLineup
        }
      });

      console.log(`  Updated ${game.slot}: ${game.teamAScore} - ${game.teamBScore}`);
    }

    console.log(`✅ Added forfeit indicators to ${match.games.length} games\n`);
  }

  console.log('=== SUMMARY ===');
  console.log('✅ Forfeit indicators added to all forfeit games');
  console.log('✅ Winning teams are clearly identified');
  console.log('✅ Forfeiting teams are clearly marked');
  console.log('\nThe games will now show:');
  console.log('- "WINNER" for the team that won by forfeit');
  console.log('- "FORFEIT" for the team that forfeited');
  console.log('- This makes it clear which team won and that it was a forfeit');
}

main().catch(console.error).finally(() => prisma.$disconnect());
