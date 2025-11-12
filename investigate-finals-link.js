const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateFinalsLink() {
  try {
    console.log('=== Investigating Finals Match Linking ===\n');

    // Find Match 7 (Winner Bracket Final)
    const matches = await prisma.match.findMany({
      where: {
        round: {
          stop: {
            tournament: {
              name: { contains: 'Bracket Test 4' }
            }
          }
        }
      },
      include: {
        round: {
          select: {
            bracketType: true,
            depth: true,
            idx: true,
          }
        },
        teamA: { select: { name: true } },
        teamB: { select: { name: true } },
      },
      orderBy: {
        round: {
          idx: 'asc'
        }
      }
    });

    // Find Match 7 (Winner bracket, should be last winner round)
    const match7 = matches.find(m =>
      m.round?.bracketType === 'WINNER' &&
      m.teamA?.name?.includes('Barrie') &&
      m.teamB?.name?.includes('Belleville')
    );

    if (match7) {
      console.log('Match 7 (Winner Bracket Final):');
      console.log(`  ID: ${match7.id}`);
      console.log(`  Teams: ${match7.teamA?.name} vs ${match7.teamB?.name}`);
      console.log(`  Winner: ${match7.winnerId}`);
      console.log(`  Bracket: ${match7.round?.bracketType}, Depth: ${match7.round?.depth}`);
      console.log('');

      // Find child matches (matches that have Match 7 as source)
      const childMatchesA = await prisma.match.findMany({
        where: { sourceMatchAId: match7.id },
        include: {
          round: { select: { bracketType: true, depth: true } },
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
        }
      });

      const childMatchesB = await prisma.match.findMany({
        where: { sourceMatchBId: match7.id },
        include: {
          round: { select: { bracketType: true, depth: true } },
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
        }
      });

      console.log(`Child matches via sourceMatchAId: ${childMatchesA.length}`);
      childMatchesA.forEach(m => {
        console.log(`  - Match ${m.id.slice(0, 8)}: ${m.teamA?.name || 'TBD'} vs ${m.teamB?.name || 'TBD'}`);
        console.log(`    Bracket: ${m.round?.bracketType}, Depth: ${m.round?.depth}`);
      });

      console.log(`\nChild matches via sourceMatchBId: ${childMatchesB.length}`);
      childMatchesB.forEach(m => {
        console.log(`  - Match ${m.id.slice(0, 8)}: ${m.teamA?.name || 'TBD'} vs ${m.teamB?.name || 'TBD'}`);
        console.log(`    Bracket: ${m.round?.bracketType}, Depth: ${m.round?.depth}`);
      });
    }

    console.log('\n--- Finals Matches ---');
    const finalsMatches = matches.filter(m => m.round?.bracketType === 'FINALS');
    finalsMatches.forEach((m, idx) => {
      console.log(`\nFinals Match ${idx + 1} (depth ${m.round?.depth}):`);
      console.log(`  ID: ${m.id.slice(0, 8)}`);
      console.log(`  Teams: ${m.teamA?.name || 'TBD'} vs ${m.teamB?.name || 'TBD'}`);
      console.log(`  sourceMatchAId: ${m.sourceMatchAId?.slice(0, 8) || 'null'}`);
      console.log(`  sourceMatchBId: ${m.sourceMatchBId?.slice(0, 8) || 'null'}`);
    });

    console.log('\n--- Match 13 (Loser Bracket Final) ---');
    const match13 = matches.find(m =>
      m.round?.bracketType === 'LOSER' &&
      m.teamA?.name?.includes('Pickering') &&
      m.teamB?.name?.includes('Belleville')
    );

    if (match13) {
      console.log(`  ID: ${match13.id.slice(0, 8)}`);
      console.log(`  Teams: ${match13.teamA?.name} vs ${match13.teamB?.name}`);
      console.log(`  Winner: ${match13.winnerId?.slice(0, 8)}`);

      // Check if Match 13 advanced its winner
      const match13ChildrenA = await prisma.match.findMany({
        where: { sourceMatchBId: match13.id },
        include: {
          round: { select: { bracketType: true } },
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
        }
      });

      console.log(`\n  Child matches via sourceMatchBId: ${match13ChildrenA.length}`);
      match13ChildrenA.forEach(m => {
        console.log(`    - ${m.teamA?.name || 'TBD'} vs ${m.teamB?.name || 'TBD'} (${m.round?.bracketType})`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

investigateFinalsLink();
