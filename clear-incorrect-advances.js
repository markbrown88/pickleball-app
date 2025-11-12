const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearIncorrectAdvances() {
  try {
    const tournament = await prisma.tournament.findFirst({
      where: { name: { contains: 'Bracket Test 4' } },
      include: {
        stops: {
          include: {
            rounds: {
              include: {
                matches: {
                  include: {
                    round: { select: { bracketType: true, idx: true } },
                    teamA: { select: { name: true } },
                    games: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tournament || !tournament.stops[0]) {
      console.error('Tournament not found');
      return;
    }

    const rounds = tournament.stops[0].rounds.sort((a, b) => {
      const bracketOrder = { 'WINNER': 0, 'LOSER': 1, 'FINALS': 2 };
      const orderA = bracketOrder[a.bracketType] ?? 99;
      const orderB = bracketOrder[b.bracketType] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.idx - b.idx;
    });

    console.log('🔄 Clearing incorrectly advanced teams from non-BYE matches...\n');

    let matchNumber = 1;
    let fixedCount = 0;

    for (const round of rounds) {
      for (const match of round.matches) {
        // Match is incorrectly completed if:
        // 1. It's NOT a BYE match
        // 2. It has a winnerId set
        // 3. It has no games (wasn't manually completed)
        if (!match.isBye && match.winnerId && match.games.length === 0) {
          console.log(`Match ${matchNumber} (Round ${match.round?.idx}, ${match.round?.bracketType}):`);
          console.log(`  ${match.teamA?.name || 'null'}`);
          console.log(`  WinnerId: ${match.winnerId.slice(0, 8)}`);

          // Clear winner
          await prisma.match.update({
            where: { id: match.id },
            data: { winnerId: null },
          });
          console.log(`  ✓ Cleared winnerId\n`);
          fixedCount++;
        }
        matchNumber++;
      }
    }

    console.log(`✅ Cleared ${fixedCount} incorrectly auto-completed matches\n`);

    // Now recursively clear teams from child matches that shouldn't have them yet
    console.log('🔄 Clearing incorrectly advanced teams from child matches...\n');

    const allMatches = rounds.flatMap(r => r.matches);
    let clearedCount = 0;

    for (const match of allMatches) {
      // If this match has no winner but has teams in child matches, those are incorrect
      if (!match.winnerId) {
        const childMatchesA = await prisma.match.findMany({
          where: {
            sourceMatchAId: match.id,
          },
        });

        const childMatchesB = await prisma.match.findMany({
          where: {
            sourceMatchBId: match.id,
          },
        });

        // For each child, if the source match hasn't completed, clear the team
        for (const child of childMatchesA) {
          if (child.teamAId) {
            await prisma.match.update({
              where: { id: child.id },
              data: { teamAId: null },
            });
            console.log(`  Cleared Team A from match ${child.id.slice(0, 8)} (source not complete)`);
            clearedCount++;
          }
        }

        for (const child of childMatchesB) {
          if (child.teamBId) {
            await prisma.match.update({
              where: { id: child.id },
              data: { teamBId: null },
            });
            console.log(`  Cleared Team B from match ${child.id.slice(0, 8)} (source not complete)`);
            clearedCount++;
          }
        }
      }
    }

    console.log(`\n✅ Cleared ${clearedCount} incorrectly advanced teams from child matches\n`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

clearIncorrectAdvances();
