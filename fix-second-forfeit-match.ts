import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Fixing Second Forfeit Match ===\n');
  console.log('Stop 2, Round 7: 4 Fathers Advanced vs Wildcard Advanced\n');

  // Find the second forfeit match
  const forfeitMatch = await prisma.match.findFirst({
    where: {
      teamA: { name: '4 Fathers Advanced' },
      teamB: { name: 'Wildcard Advanced' },
      round: {
        stop: { name: 'Stop 2' },
        idx: 6 // Round 7 (0-based index)
      }
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
        select: {
          id: true,
          slot: true,
          teamAScore: true,
          teamBScore: true,
          isComplete: true
        }
      }
    }
  });

  if (!forfeitMatch) {
    console.log('❌ Forfeit match not found');
    return;
  }

  console.log('Current match status:');
  console.log(`  Match ID: ${forfeitMatch.id}`);
  console.log(`  Forfeit team: ${forfeitMatch.forfeitTeam}`);
  console.log(`  Current games: ${forfeitMatch.games.length}`);
  console.log(`  Games: ${forfeitMatch.games.map(g => g.slot).join(', ')}`);

  // Determine which team won (the one that didn't forfeit)
  const winningTeam = forfeitMatch.forfeitTeam === 'A' ? 'B' : 'A';
  const forfeitingTeam = forfeitMatch.forfeitTeam === 'A' ? 'A' : 'B';

  console.log(`\nForfeit details:`);
  console.log(`  Forfeiting team: ${forfeitingTeam} (${forfeitingTeam === 'A' ? forfeitMatch.teamA?.name : forfeitMatch.teamB?.name})`);
  console.log(`  Winning team: ${winningTeam} (${winningTeam === 'A' ? forfeitMatch.teamA?.name : forfeitMatch.teamB?.name})`);

  // Check what games already exist
  const existingSlots = forfeitMatch.games.map(g => g.slot);
  const requiredSlots = ['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2'];
  const missingSlots = requiredSlots.filter(slot => !existingSlots.includes(slot));

  console.log(`\nGames analysis:`);
  console.log(`  Existing games: ${existingSlots.join(', ')}`);
  console.log(`  Required games: ${requiredSlots.join(', ')}`);
  console.log(`  Missing games: ${missingSlots.join(', ')}`);

  if (missingSlots.length === 0) {
    console.log('✅ All required games already exist');
    
    // Update existing games to have proper forfeit scores
    for (const game of forfeitMatch.games) {
      if (requiredSlots.includes(game.slot)) {
        const teamAScore = winningTeam === 'A' ? 11 : 0;
        const teamBScore = winningTeam === 'B' ? 11 : 0;

        await prisma.game.update({
          where: { id: game.id },
          data: {
            teamAScore: teamAScore,
            teamBScore: teamBScore,
            isComplete: true,
            teamALineup: Prisma.JsonNull, // No lineups for forfeit
            teamBLineup: Prisma.JsonNull  // No lineups for forfeit
          }
        });

        console.log(`  Updated ${game.slot}: ${teamAScore} - ${teamBScore} (Complete: true)`);
      }
    }
  } else {
    console.log(`\nCreating missing games...`);

    // Create missing games
    for (const slot of missingSlots) {
      const teamAScore = winningTeam === 'A' ? 11 : 0;
      const teamBScore = winningTeam === 'B' ? 11 : 0;

      const newGame = await prisma.game.create({
        data: {
          matchId: forfeitMatch.id,
          slot: slot,
          teamAScore: teamAScore,
          teamBScore: teamBScore,
          isComplete: true,
          teamALineup: Prisma.JsonNull, // No lineups for forfeit
          teamBLineup: Prisma.JsonNull, // No lineups for forfeit
          lineupConfirmed: false // No lineups to confirm
        }
      });

      console.log(`  Created ${slot}: ${teamAScore} - ${teamBScore} (Complete: true)`);
    }

    // Also update any existing games that aren't the main 4
    for (const game of forfeitMatch.games) {
      if (requiredSlots.includes(game.slot)) {
        const teamAScore = winningTeam === 'A' ? 11 : 0;
        const teamBScore = winningTeam === 'B' ? 11 : 0;

        await prisma.game.update({
          where: { id: game.id },
          data: {
            teamAScore: teamAScore,
            teamBScore: teamBScore,
            isComplete: true,
            teamALineup: Prisma.JsonNull,
            teamBLineup: Prisma.JsonNull
          }
        });

        console.log(`  Updated ${game.slot}: ${teamAScore} - ${teamBScore} (Complete: true)`);
      }
    }
  }

  // Verify the final state
  const updatedMatch = await prisma.match.findUnique({
    where: { id: forfeitMatch.id },
    include: {
      games: {
        select: {
          slot: true,
          teamAScore: true,
          teamBScore: true,
          isComplete: true,
          teamALineup: true,
          teamBLineup: true
        },
        orderBy: { slot: 'asc' }
      }
    }
  });

  console.log(`\n=== FINAL RESULT ===`);
  console.log(`Match: ${forfeitMatch.teamA?.name} vs ${forfeitMatch.teamB?.name}`);
  console.log(`Forfeit team: ${forfeitMatch.forfeitTeam}`);
  console.log(`Total games: ${updatedMatch?.games.length}`);
  
  const mainGames = updatedMatch?.games.filter(g => requiredSlots.includes(g.slot)) || [];
  const allMainGamesComplete = mainGames.every(g => g.isComplete);
  
  console.log(`Main games (4): ${mainGames.length}`);
  console.log(`All main games complete: ${allMainGamesComplete ? '✅ YES' : '❌ NO'}`);
  
  console.log(`\nGame details:`);
  mainGames.forEach(game => {
    console.log(`  ${game.slot}: ${game.teamAScore} - ${game.teamBScore} (Complete: ${game.isComplete})`);
  });

  if (allMainGamesComplete && mainGames.length === 4) {
    console.log(`\n✅ Second forfeit match is now properly set up!`);
    console.log(`   - All 4 main games exist`);
    console.log(`   - All games are complete`);
    console.log(`   - Winning team gets 11 points, forfeiting team gets 0`);
    console.log(`   - No lineups (as expected for forfeit)`);
    console.log(`   - Match should now be considered "Finished"`);
  } else {
    console.log(`\n❌ Something went wrong with the forfeit setup`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
