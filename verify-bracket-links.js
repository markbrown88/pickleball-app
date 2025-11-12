const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyBracketLinks() {
  try {
    console.log('=== Verifying Bracket Structure ===\n');

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
      },
      orderBy: {
        round: {
          idx: 'asc'
        }
      }
    });

    const winnerMatches = matches.filter(m => m.round?.bracketType === 'WINNER');
    const loserMatches = matches.filter(m => m.round?.bracketType === 'LOSER');
    const finalsMatches = matches.filter(m => m.round?.bracketType === 'FINALS');

    console.log('=== Winner Bracket ===');
    winnerMatches.forEach((m, idx) => {
      console.log(`\nWinner Match ${idx + 1} (Round ${m.round?.idx}, depth ${m.round?.depth}):`);
      console.log(`  ID: ${m.id.slice(0, 8)}`);
      console.log(`  sourceMatchAId: ${m.sourceMatchAId?.slice(0, 8) || 'null'}`);
      console.log(`  sourceMatchBId: ${m.sourceMatchBId?.slice(0, 8) || 'null'}`);
    });

    console.log('\n\n=== Loser Bracket ===');
    loserMatches.forEach((m, idx) => {
      console.log(`\nLoser Match ${idx + 1} (Round ${m.round?.idx}, depth ${m.round?.depth}):`);
      console.log(`  ID: ${m.id.slice(0, 8)}`);
      console.log(`  sourceMatchAId: ${m.sourceMatchAId?.slice(0, 8) || 'null'}`);
      console.log(`  sourceMatchBId: ${m.sourceMatchBId?.slice(0, 8) || 'null'}`);

      // Verify the source matches exist
      if (m.sourceMatchAId) {
        const sourceA = matches.find(sm => sm.id === m.sourceMatchAId);
        if (sourceA) {
          console.log(`    ✓ Source A: ${sourceA.round?.bracketType} Round ${sourceA.round?.idx}`);
        } else {
          console.log(`    ✗ Source A: NOT FOUND`);
        }
      }

      if (m.sourceMatchBId) {
        const sourceB = matches.find(sm => sm.id === m.sourceMatchBId);
        if (sourceB) {
          console.log(`    ✓ Source B: ${sourceB.round?.bracketType} Round ${sourceB.round?.idx}`);
        } else {
          console.log(`    ✗ Source B: NOT FOUND`);
        }
      } else {
        console.log(`    ⚠ Source B: null (might be BYE match)`);
      }
    });

    console.log('\n\n=== Finals ===');
    finalsMatches.forEach((m, idx) => {
      console.log(`\nFinals Match ${idx + 1} (Round ${m.round?.idx}, depth ${m.round?.depth}):`);
      console.log(`  ID: ${m.id.slice(0, 8)}`);
      console.log(`  sourceMatchAId: ${m.sourceMatchAId?.slice(0, 8) || 'null'}`);
      console.log(`  sourceMatchBId: ${m.sourceMatchBId?.slice(0, 8) || 'null'}`);

      if (m.sourceMatchAId) {
        const sourceA = matches.find(sm => sm.id === m.sourceMatchAId);
        if (sourceA) {
          console.log(`    ✓ Source A: ${sourceA.round?.bracketType} Round ${sourceA.round?.idx}`);
        }
      }

      if (m.sourceMatchBId) {
        const sourceB = matches.find(sm => sm.id === m.sourceMatchBId);
        if (sourceB) {
          console.log(`    ✓ Source B: ${sourceB.round?.bracketType} Round ${sourceB.round?.idx}`);
        }
      }
    });

    // Check for the critical link: Winner Bracket Final → Loser Bracket Final
    console.log('\n\n=== Critical Verification ===');
    const winnerFinal = winnerMatches.find(m => m.round?.depth === 0);
    const loserFinal = loserMatches.find(m => m.round?.depth === 0);

    if (winnerFinal && loserFinal) {
      console.log(`\nWinner Bracket Final ID: ${winnerFinal.id.slice(0, 8)}`);
      console.log(`Loser Bracket Final ID: ${loserFinal.id.slice(0, 8)}`);
      console.log(`Loser Bracket Final sourceMatchBId: ${loserFinal.sourceMatchBId?.slice(0, 8) || 'null'}`);

      if (loserFinal.sourceMatchBId === winnerFinal.id) {
        console.log('✅ CORRECT: Winner Bracket Final feeds into Loser Bracket Final as sourceMatchBId');
      } else {
        console.log('❌ ERROR: Winner Bracket Final does NOT feed into Loser Bracket Final');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

verifyBracketLinks();
