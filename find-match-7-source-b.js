const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findMatch7SourceB() {
  try {
    console.log('=== Finding What Should Feed Into Match 7 as Team B ===\n');

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
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        games: {
          select: {
            isComplete: true,
          }
        },
      },
      orderBy: {
        round: {
          idx: 'asc'
        }
      }
    });

    console.log('All Loser Bracket Matches:\n');
    const loserMatches = matches.filter(m => m.round?.bracketType === 'LOSER');

    loserMatches.forEach((m, idx) => {
      const completeGames = m.games.filter(g => g.isComplete).length;
      console.log(`Match ${idx + 1} (Round idx ${m.round?.idx}, depth ${m.round?.depth}):`);
      console.log(`  ID: ${m.id.slice(0, 8)}`);
      console.log(`  Teams: ${m.teamA?.name || 'TBD'} vs ${m.teamB?.name || 'TBD'}`);
      console.log(`  Winner: ${m.winnerId ? m.winnerId.slice(0, 8) : 'null'}`);
      console.log(`  Games: ${completeGames}/${m.games.length} complete`);
      console.log(`  sourceMatchAId: ${m.sourceMatchAId?.slice(0, 8) || 'null'}`);
      console.log(`  sourceMatchBId: ${m.sourceMatchBId?.slice(0, 8) || 'null'}`);
      console.log('');
    });

    // Check which matches feed into Match 7 (the loser bracket final at depth 0)
    const match7 = loserMatches.find(m => m.round?.depth === 0);

    if (match7) {
      console.log('\n=== Match 7 (Loser Bracket Final at depth 0) ===');
      console.log(`  sourceMatchAId: ${match7.sourceMatchAId?.slice(0, 8) || 'null'}`);
      console.log(`  sourceMatchBId: ${match7.sourceMatchBId?.slice(0, 8) || 'null'}`);

      console.log('\n  Looking for matches at depth 1 (one level below final):');
      const depth1Matches = loserMatches.filter(m => m.round?.depth === 1);
      depth1Matches.forEach(m => {
        const completeGames = m.games.filter(g => g.isComplete).length;
        console.log(`    - Match ${m.id.slice(0, 8)} (Round idx ${m.round?.idx}):`);
        console.log(`      ${m.teamA?.name || 'TBD'} vs ${m.teamB?.name || 'TBD'}`);
        console.log(`      Winner: ${m.winnerId ? m.winnerId.slice(0, 8) : 'null'}`);
        console.log(`      Complete: ${completeGames}/${m.games.length}`);
      });

      console.log('\n  ⚠️ ISSUE: Match 7 has sourceMatchBId = null');
      console.log('  This means the bracket structure is incomplete.');
      console.log('  In a proper double elimination loser bracket final, there should be');
      console.log('  TWO matches at depth 1 feeding into the depth 0 final.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

findMatch7SourceB();
