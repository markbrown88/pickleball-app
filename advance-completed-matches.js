const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function advanceCompletedMatches() {
  try {
    // Find all completed matches that have winners
    const completedMatches = await prisma.match.findMany({
      where: {
        winnerId: { not: null },
      },
      include: {
        round: { select: { bracketType: true, stopId: true } },
      },
    });

    console.log(`\n=== Found ${completedMatches.length} completed matches ===\n`);

    for (const match of completedMatches) {
      console.log(`Match ${match.id.slice(0, 8)} (${match.round.bracketType}): Winner ${match.winnerId.slice(0, 8)}`);

      // Find child matches
      const childMatchesA = await prisma.match.findMany({
        where: { sourceMatchAId: match.id },
        include: { round: { select: { bracketType: true } } },
      });

      const childMatchesB = await prisma.match.findMany({
        where: { sourceMatchBId: match.id },
        include: { round: { select: { bracketType: true } } },
      });

      // Separate by bracket type
      const winnerChildrenA = childMatchesA.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
      const winnerChildrenB = childMatchesB.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
      const loserChildrenA = childMatchesA.filter(m => m.round?.bracketType === 'LOSER');
      const loserChildrenB = childMatchesB.filter(m => m.round?.bracketType === 'LOSER');

      // Advance winner to winner/finals bracket
      for (const child of winnerChildrenA) {
        if (!child.teamAId || child.teamAId !== match.winnerId) {
          await prisma.match.update({
            where: { id: child.id },
            data: { teamAId: match.winnerId },
          });
          console.log(`  ✓ Advanced winner to ${child.round.bracketType} match ${child.id.slice(0, 8)} as Team A`);
        }
      }

      for (const child of winnerChildrenB) {
        if (!child.teamBId || child.teamBId !== match.winnerId) {
          await prisma.match.update({
            where: { id: child.id },
            data: { teamBId: match.winnerId },
          });
          console.log(`  ✓ Advanced winner to ${child.round.bracketType} match ${child.id.slice(0, 8)} as Team B`);
        }
      }

      // Advance loser to loser bracket (only if this is a WINNER bracket match)
      if (match.round.bracketType === 'WINNER') {
        const loserId = match.teamAId === match.winnerId ? match.teamBId : match.teamAId;

        if (loserId && !match.isBye) {
          for (const child of loserChildrenA) {
            if (!child.teamAId || child.teamAId !== loserId) {
              await prisma.match.update({
                where: { id: child.id },
                data: { teamAId: loserId },
              });
              console.log(`  ✓ Advanced loser to LOSER match ${child.id.slice(0, 8)} as Team A`);
            }
          }

          for (const child of loserChildrenB) {
            if (!child.teamBId || child.teamBId !== loserId) {
              await prisma.match.update({
                where: { id: child.id },
                data: { teamBId: loserId },
              });
              console.log(`  ✓ Advanced loser to LOSER match ${child.id.slice(0, 8)} as Team B`);
            }
          }
        }
      }
    }

    console.log(`\n✅ Processed ${completedMatches.length} completed matches`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

advanceCompletedMatches();
