const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateMatch6To7() {
  try {
    console.log('=== Investigating Match 6 → Match 7 Advancement ===\n');

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
            id: true,
            isComplete: true,
            teamAScore: true,
            teamBScore: true,
          }
        },
      },
      orderBy: {
        round: {
          idx: 'asc'
        }
      }
    });

    // Find Match 6 (loser bracket, depth 1, with Pickering winner)
    const match6 = matches.find(m =>
      m.round?.bracketType === 'LOSER' &&
      m.round?.depth === 1 &&
      m.teamA?.name?.includes('Pickering')
    );

    // Find Match 7 (loser bracket, depth 0 - the final)
    const match7 = matches.find(m =>
      m.round?.bracketType === 'LOSER' &&
      m.round?.depth === 0
    );

    if (match6) {
      console.log('Match 6 (Loser Bracket, depth 1):');
      console.log(`  ID: ${match6.id}`);
      console.log(`  Round idx: ${match6.round?.idx}`);
      console.log(`  Teams: ${match6.teamA?.name} vs ${match6.teamB?.name}`);
      console.log(`  Winner ID: ${match6.winnerId}`);
      console.log(`  Winner is: ${match6.winnerId === match6.teamAId ? 'Team A' : match6.winnerId === match6.teamBId ? 'Team B' : 'Unknown'}`);
      console.log(`  Complete games: ${match6.games.filter(g => g.isComplete).length}/${match6.games.length}`);
      console.log(`  sourceMatchAId: ${match6.sourceMatchAId || 'null'}`);
      console.log(`  sourceMatchBId: ${match6.sourceMatchBId || 'null'}`);
      console.log('');

      // Find all child matches
      const childMatchesA = await prisma.match.findMany({
        where: { sourceMatchAId: match6.id },
        include: {
          round: { select: { bracketType: true, depth: true, idx: true } },
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
        }
      });

      const childMatchesB = await prisma.match.findMany({
        where: { sourceMatchBId: match6.id },
        include: {
          round: { select: { bracketType: true, depth: true, idx: true } },
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
        }
      });

      console.log(`  Child matches via sourceMatchAId: ${childMatchesA.length}`);
      childMatchesA.forEach(m => {
        console.log(`    - Match ${m.id.slice(0, 8)}: ${m.teamA?.name || 'TBD'} vs ${m.teamB?.name || 'TBD'}`);
        console.log(`      Bracket: ${m.round?.bracketType}, Depth: ${m.round?.depth}, Round idx: ${m.round?.idx}`);
      });

      console.log(`  Child matches via sourceMatchBId: ${childMatchesB.length}`);
      childMatchesB.forEach(m => {
        console.log(`    - Match ${m.id.slice(0, 8)}: ${m.teamA?.name || 'TBD'} vs ${m.teamB?.name || 'TBD'}`);
        console.log(`      Bracket: ${m.round?.bracketType}, Depth: ${m.round?.depth}, Round idx: ${m.round?.idx}`);
      });
    }

    console.log('\n--- Match 7 (Loser Bracket Final) ---');
    if (match7) {
      console.log(`  ID: ${match7.id}`);
      console.log(`  Round idx: ${match7.round?.idx}`);
      console.log(`  Teams: ${match7.teamA?.name || 'TBD'} vs ${match7.teamB?.name || 'TBD'}`);
      console.log(`  Team A ID: ${match7.teamAId || 'null'}`);
      console.log(`  Team B ID: ${match7.teamBId || 'null'}`);
      console.log(`  Winner ID: ${match7.winnerId || 'null'}`);
      console.log(`  sourceMatchAId: ${match7.sourceMatchAId?.slice(0, 8) || 'null'}`);
      console.log(`  sourceMatchBId: ${match7.sourceMatchBId?.slice(0, 8) || 'null'}`);
      console.log(`  Complete games: ${match7.games.filter(g => g.isComplete).length}/${match7.games.length}`);
      console.log('');

      // Check if Match 7's source matches point to Match 6
      if (match6) {
        const match7SourcesMatch6A = match7.sourceMatchAId === match6.id;
        const match7SourcesMatch6B = match7.sourceMatchBId === match6.id;

        console.log(`  Does Match 7's sourceMatchAId point to Match 6? ${match7SourcesMatch6A ? 'YES' : 'NO'}`);
        console.log(`  Does Match 7's sourceMatchBId point to Match 6? ${match7SourcesMatch6B ? 'YES' : 'NO'}`);

        if (match7SourcesMatch6A || match7SourcesMatch6B) {
          console.log('\n  ⚠️  Match 7 SHOULD have received Match 6\'s winner!');
          console.log(`  Expected: Match 6 winner (${match6.winnerId?.slice(0, 8)}) should be in Match 7`);
          console.log(`  Actual: Team A: ${match7.teamAId?.slice(0, 8) || 'null'}, Team B: ${match7.teamBId?.slice(0, 8) || 'null'}`);
        }
      }

      // Find what matches feed into Match 7
      if (match7.sourceMatchAId) {
        const sourceMatchA = matches.find(m => m.id === match7.sourceMatchAId);
        if (sourceMatchA) {
          console.log('\n  Source Match A:');
          console.log(`    ID: ${sourceMatchA.id.slice(0, 8)}`);
          console.log(`    Teams: ${sourceMatchA.teamA?.name || 'TBD'} vs ${sourceMatchA.teamB?.name || 'TBD'}`);
          console.log(`    Winner: ${sourceMatchA.winnerId?.slice(0, 8) || 'null'}`);
          console.log(`    Round: ${sourceMatchA.round?.bracketType}, idx ${sourceMatchA.round?.idx}, depth ${sourceMatchA.round?.depth}`);
        }
      }

      if (match7.sourceMatchBId) {
        const sourceMatchB = matches.find(m => m.id === match7.sourceMatchBId);
        if (sourceMatchB) {
          console.log('\n  Source Match B:');
          console.log(`    ID: ${sourceMatchB.id.slice(0, 8)}`);
          console.log(`    Teams: ${sourceMatchB.teamA?.name || 'TBD'} vs ${sourceMatchB.teamB?.name || 'TBD'}`);
          console.log(`    Winner: ${sourceMatchB.winnerId?.slice(0, 8) || 'null'}`);
          console.log(`    Round: ${sourceMatchB.round?.bracketType}, idx ${sourceMatchB.round?.idx}, depth ${sourceMatchB.round?.depth}`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

investigateMatch6To7();
