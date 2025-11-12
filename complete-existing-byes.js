const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function completeExistingByes() {
  try {
    const tournament = await prisma.tournament.findFirst({
      where: { name: { contains: 'Bracket Test 4' } },
      include: {
        stops: {
          include: {
            rounds: true,
          },
        },
      },
    });

    if (!tournament || !tournament.stops[0]) {
      console.error('Tournament not found');
      return;
    }

    const stop = tournament.stops[0];

    console.log('🔄 Finding and completing existing BYE matches...\n');

    // Find all BYE matches with teams but no winner
    const byeMatches = await prisma.match.findMany({
      where: {
        round: { stopId: stop.id },
        isBye: true,
        teamAId: { not: null },
        winnerId: null,
      },
      include: {
        round: { select: { bracketType: true, idx: true } },
        teamA: { select: { name: true } },
      },
    });

    console.log(`Found ${byeMatches.length} BYE matches to complete:\n`);

    for (const byeMatch of byeMatches) {
      console.log(`Match ${byeMatch.id.slice(0, 8)} (Round ${byeMatch.round?.idx}, ${byeMatch.round?.bracketType}):`);
      console.log(`  Team: ${byeMatch.teamA?.name}`);

      // Set winner
      await prisma.match.update({
        where: { id: byeMatch.id },
        data: { winnerId: byeMatch.teamAId },
      });
      console.log(`  ✓ Set winnerId: ${byeMatch.teamAId?.slice(0, 8)}`);

      // Find child matches and advance winner
      const childMatchesA = await prisma.match.findMany({
        where: { sourceMatchAId: byeMatch.id },
        include: { round: { select: { bracketType: true, idx: true } } },
      });

      const childMatchesB = await prisma.match.findMany({
        where: { sourceMatchBId: byeMatch.id },
        include: { round: { select: { bracketType: true, idx: true } } },
      });

      // Filter by bracket type
      let targetChildrenA = childMatchesA;
      let targetChildrenB = childMatchesB;

      if (byeMatch.round?.bracketType === 'LOSER') {
        // Loser bracket BYE advances to loser bracket or finals
        targetChildrenA = childMatchesA.filter(m => m.round?.bracketType === 'LOSER' || m.round?.bracketType === 'FINALS');
        targetChildrenB = childMatchesB.filter(m => m.round?.bracketType === 'LOSER' || m.round?.bracketType === 'FINALS');
      } else {
        // Winner bracket BYE advances to winner/finals bracket
        targetChildrenA = childMatchesA.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
        targetChildrenB = childMatchesB.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
      }

      // Advance winner to child matches
      for (const child of targetChildrenA) {
        await prisma.match.update({
          where: { id: child.id },
          data: { teamAId: byeMatch.teamAId },
        });
        console.log(`  → Advanced to ${child.round?.bracketType} Round ${child.round?.idx} as Team A`);
      }

      for (const child of targetChildrenB) {
        await prisma.match.update({
          where: { id: child.id },
          data: { teamBId: byeMatch.teamAId },
        });
        console.log(`  → Advanced to ${child.round?.bracketType} Round ${child.round?.idx} as Team B`);
      }

      console.log('');
    }

    console.log(`✅ Completed ${byeMatches.length} BYE matches\n`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

completeExistingByes();
