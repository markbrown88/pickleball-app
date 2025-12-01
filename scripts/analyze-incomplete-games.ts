import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function analyzeIncompleteGames() {
  console.log('\n' + '='.repeat(80));
  console.log('ANALYZING INCOMPLETE GAMES');
  console.log('='.repeat(80));

  // Find tournaments
  const tournaments = await prisma.tournament.findMany({
    where: {
      OR: [
        { name: { contains: 'KLYNG CUP-GRAND', mode: 'insensitive' } },
        { name: { contains: 'KLYNG CUP - GRAND FINALE', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
    },
  });

  const tournamentIds = tournaments.map(t => t.id);

  console.log(`\n🏆 Tournaments Found:`);
  tournaments.forEach(t => {
    console.log(`   ${t.name}`);
  });

  // Get all games
  const allGames = await prisma.game.findMany({
    where: {
      match: {
        round: {
          stop: {
            tournamentId: { in: tournamentIds },
          },
        },
      },
      OR: [
        { slot: 'MENS_DOUBLES' },
        { slot: 'WOMENS_DOUBLES' },
        { slot: 'MIXED_1' },
        { slot: 'MIXED_2' },
      ],
    },
    include: {
      match: {
        include: {
          round: {
            include: {
              stop: {
                select: {
                  name: true,
                  tournament: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          teamA: {
            select: {
              name: true,
            },
          },
          teamB: {
            select: {
              name: true,
            },
          },
        },
      },
      bracket: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      {
        match: {
          round: {
            stop: {
              startAt: 'asc',
            },
          },
        },
      },
      {
        match: {
          round: {
            idx: 'asc',
          },
        },
      },
    ],
  });

  console.log(`\n📊 Total Games: ${allGames.length}`);
  console.log(`   Completed Games: ${allGames.filter(g => g.isComplete).length}`);
  console.log(`   Incomplete Games: ${allGames.filter(g => !g.isComplete).length}`);

  // Categorize incomplete games
  const incompleteGames = allGames.filter(g => !g.isComplete || g.teamAScore === null || g.teamBScore === null);

  const categories = {
    notYetPlayed: [] as typeof incompleteGames,
    inProgress: [] as typeof incompleteGames,
    notMarkedComplete: [] as typeof incompleteGames,
    missingScores: [] as typeof incompleteGames,
  };

  for (const game of incompleteGames) {
    const hasNoScores = game.teamAScore === null && game.teamBScore === null;
    const hasOneScore = (game.teamAScore === null && game.teamBScore !== null) || 
                        (game.teamAScore !== null && game.teamBScore === null);
    const hasBothScores = game.teamAScore !== null && game.teamBScore !== null;
    const isComplete = game.isComplete;

    if (hasNoScores && !isComplete) {
      categories.notYetPlayed.push(game);
    } else if (hasOneScore && !isComplete) {
      categories.inProgress.push(game);
    } else if (hasBothScores && !isComplete) {
      categories.notMarkedComplete.push(game);
    } else if (hasNoScores || hasOneScore) {
      categories.missingScores.push(game);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('INCOMPLETE GAMES BREAKDOWN');
  console.log('='.repeat(80));

  console.log(`\n1️⃣  NOT YET PLAYED (${categories.notYetPlayed.length} games):`);
  console.log(`   Games with no scores and not marked complete`);
  if (categories.notYetPlayed.length > 0) {
    categories.notYetPlayed.forEach((game, idx) => {
      const match = game.match;
      const round = match.round;
      const stop = round.stop;
      console.log(`\n   ${idx + 1}. ${stop.tournament.name} - ${stop.name}`);
      console.log(`      Round ${round.idx} (${round.bracketType})`);
      console.log(`      ${match.teamA?.name || 'TBD'} vs ${match.teamB?.name || 'TBD'}`);
      console.log(`      ${game.slot} - ${game.bracket?.name || 'No Bracket'}`);
      console.log(`      Game ID: ${game.id}`);
      console.log(`      Status: isComplete=${game.isComplete}, teamAScore=${game.teamAScore}, teamBScore=${game.teamBScore}`);
    });
  }

  console.log(`\n2️⃣  IN PROGRESS (${categories.inProgress.length} games):`);
  console.log(`   Games with one score entered but not complete`);
  if (categories.inProgress.length > 0) {
    categories.inProgress.forEach((game, idx) => {
      const match = game.match;
      const round = match.round;
      const stop = round.stop;
      console.log(`\n   ${idx + 1}. ${stop.tournament.name} - ${stop.name}`);
      console.log(`      Round ${round.idx} (${round.bracketType})`);
      console.log(`      ${match.teamA?.name || 'TBD'} vs ${match.teamB?.name || 'TBD'}`);
      console.log(`      ${game.slot} - ${game.bracket?.name || 'No Bracket'}`);
      console.log(`      Score: ${game.teamAScore ?? 'null'} - ${game.teamBScore ?? 'null'}`);
      console.log(`      Game ID: ${game.id}`);
    });
  }

  console.log(`\n3️⃣  CREATED BUT NOT MARKED COMPLETE (${categories.notMarkedComplete.length} games):`);
  console.log(`   Games with both scores but isComplete=false`);
  if (categories.notMarkedComplete.length > 0) {
    categories.notMarkedComplete.forEach((game, idx) => {
      const match = game.match;
      const round = match.round;
      const stop = round.stop;
      console.log(`\n   ${idx + 1}. ${stop.tournament.name} - ${stop.name}`);
      console.log(`      Round ${round.idx} (${round.bracketType})`);
      console.log(`      ${match.teamA?.name || 'TBD'} vs ${match.teamB?.name || 'TBD'}`);
      console.log(`      ${game.slot} - ${game.bracket?.name || 'No Bracket'}`);
      console.log(`      Score: ${game.teamAScore} - ${game.teamBScore}`);
      console.log(`      Game ID: ${game.id}`);
    });
  }

  console.log(`\n4️⃣  MISSING SCORES (${categories.missingScores.length} games):`);
  console.log(`   Games marked complete but missing one or both scores`);
  if (categories.missingScores.length > 0) {
    categories.missingScores.forEach((game, idx) => {
      const match = game.match;
      const round = match.round;
      const stop = round.stop;
      console.log(`\n   ${idx + 1}. ${stop.tournament.name} - ${stop.name}`);
      console.log(`      Round ${round.idx} (${round.bracketType})`);
      console.log(`      ${match.teamA?.name || 'TBD'} vs ${match.teamB?.name || 'TBD'}`);
      console.log(`      ${game.slot} - ${game.bracket?.name || 'No Bracket'}`);
      console.log(`      Score: ${game.teamAScore ?? 'null'} - ${game.teamBScore ?? 'null'}`);
      console.log(`      Game ID: ${game.id}`);
      console.log(`      Status: isComplete=${game.isComplete}`);
    });
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Incomplete Games: ${incompleteGames.length}`);
  console.log(`   Not Yet Played: ${categories.notYetPlayed.length}`);
  console.log(`   In Progress: ${categories.inProgress.length}`);
  console.log(`   Not Marked Complete: ${categories.notMarkedComplete.length}`);
  console.log(`   Missing Scores: ${categories.missingScores.length}`);
}

analyzeIncompleteGames()
  .catch((error) => {
    console.error('\n❌ Error during analysis:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

