const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function advanceByeWinners() {
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

    console.log('🔄 Finding BYE matches with winners that need to advance...\n');

    // Find all BYE matches that have a winner
    const byeMatches = await prisma.match.findMany({
      where: {
        round: { stopId: stop.id },
        isBye: true,
        winnerId: { not: null },
      },
      include: {
        round: { select: { bracketType: true, idx: true } },
        teamA: { select: { name: true } },
      },
    });

    console.log(`Found ${byeMatches.length} BYE matches with winners:\n`);

    for (const byeMatch of byeMatches) {
      console.log(`BYE Match (Round ${byeMatch.round?.idx}, ${byeMatch.round?.bracketType}):`);
      console.log(`  ID: ${byeMatch.id.slice(0, 8)}`);
      console.log(`  Winner: ${byeMatch.teamA?.name}`);

      // Find child matches
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
        targetChildrenA = childMatchesA.filter(m => m.round?.bracketType === 'LOSER' || m.round?.bracketType === 'FINALS');
        targetChildrenB = childMatchesB.filter(m => m.round?.bracketType === 'LOSER' || m.round?.bracketType === 'FINALS');
      } else {
        targetChildrenA = childMatchesA.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
        targetChildrenB = childMatchesB.filter(m => m.round?.bracketType === 'WINNER' || m.round?.bracketType === 'FINALS');
      }

      // Advance winner to child matches
      for (const child of targetChildrenA) {
        // Only advance if not already set
        const currentChild = await prisma.match.findUnique({
          where: { id: child.id },
          select: { teamAId: true },
        });

        if (currentChild?.teamAId !== byeMatch.winnerId) {
          await prisma.match.update({
            where: { id: child.id },
            data: { teamAId: byeMatch.winnerId },
          });
          console.log(`  → Advanced to ${child.round?.bracketType} Round ${child.round?.idx} as Team A`);
        } else {
          console.log(`  ✓ Already advanced to ${child.round?.bracketType} Round ${child.round?.idx} as Team A`);
        }
      }

      for (const child of targetChildrenB) {
        const currentChild = await prisma.match.findUnique({
          where: { id: child.id },
          select: { teamBId: true },
        });

        if (currentChild?.teamBId !== byeMatch.winnerId) {
          await prisma.match.update({
            where: { id: child.id },
            data: { teamBId: byeMatch.winnerId },
          });
          console.log(`  → Advanced to ${child.round?.bracketType} Round ${child.round?.idx} as Team B`);
        } else {
          console.log(`  ✓ Already advanced to ${child.round?.bracketType} Round ${child.round?.idx} as Team B`);
        }
      }

      console.log('');
    }

    console.log(`✅ Done\n`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

advanceByeWinners();
