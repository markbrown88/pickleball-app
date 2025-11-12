const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function completeByeMatches() {
  try {
    // Find all BYE matches that have a team assigned but haven't been processed
    const byeMatches = await prisma.match.findMany({
      where: {
        isBye: true,
        teamAId: { not: null },
      },
      include: {
        round: { select: { stopId: true, bracketType: true } },
      },
    });

    console.log(`\n=== Found ${byeMatches.length} BYE matches to complete ===\n`);

    for (const match of byeMatches) {
      console.log(`Processing BYE match ${match.id.slice(0, 8)}...`);

      // Set winner to teamA
      await prisma.match.update({
        where: { id: match.id },
        data: { winnerId: match.teamAId },
      });
      console.log(`  ✓ Set winner to ${match.teamAId.slice(0, 8)}`);

      // Find child matches
      const childMatchesA = await prisma.match.findMany({
        where: { sourceMatchAId: match.id },
        include: { round: { select: { bracketType: true } } },
      });

      const childMatchesB = await prisma.match.findMany({
        where: { sourceMatchBId: match.id },
        include: { round: { select: { bracketType: true } } },
      });

      console.log(`  Found ${childMatchesA.length} child matches via sourceA, ${childMatchesB.length} via sourceB`);

      // Only advance to WINNER or FINALS bracket (BYE winners don't go to loser bracket)
      const winnerChildrenA = childMatchesA.filter(
        m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS'
      );
      const winnerChildrenB = childMatchesB.filter(
        m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS'
      );

      // Advance winner
      for (const child of winnerChildrenA) {
        await prisma.match.update({
          where: { id: child.id },
          data: { teamAId: match.teamAId },
        });
        console.log(`  ✓ Advanced to child match ${child.id.slice(0, 8)} as Team A`);
      }

      for (const child of winnerChildrenB) {
        await prisma.match.update({
          where: { id: child.id },
          data: { teamBId: match.teamAId },
        });
        console.log(`  ✓ Advanced to child match ${child.id.slice(0, 8)} as Team B`);
      }

      console.log(`  ✓ BYE match complete\n`);
    }

    console.log(`\n✅ Completed ${byeMatches.length} BYE matches`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

completeByeMatches();
