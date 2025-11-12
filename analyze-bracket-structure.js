const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeBracketStructure() {
  try {
    console.log('=== Analyzing Bracket Structure ===\n');

    // Get tournament and teams
    const tournament = await prisma.tournament.findFirst({
      where: { name: { contains: 'Bracket Test 4' } },
      include: {
        stops: {
          include: {
            rounds: {
              include: {
                matches: {
                  include: {
                    teamA: { select: { id: true, name: true } },
                    teamB: { select: { id: true, name: true } },
                  }
                }
              }
            },
            teams: true
          }
        }
      }
    });

    if (!tournament) {
      console.error('Tournament not found');
      return;
    }

    console.log(`Tournament: ${tournament.name}`);
    console.log(`Bracket Type: ${tournament.bracketType}\n`);

    const stop = tournament.stops[0];
    console.log(`Teams in tournament: ${stop.teams.length}`);
    stop.teams.forEach((team, idx) => {
      console.log(`  ${idx + 1}. ${team.name}`);
    });

    console.log('\n--- Round Structure ---\n');
    const rounds = stop.rounds.sort((a, b) => a.idx - b.idx);

    rounds.forEach(round => {
      console.log(`Round ${round.idx} (${round.bracketType}, depth ${round.depth}):`);
      console.log(`  Matches: ${round.matches.length}`);
      round.matches.forEach(match => {
        console.log(`    - ${match.teamA?.name || 'TBD'} vs ${match.teamB?.name || 'TBD'}`);
        console.log(`      sourceA: ${match.sourceMatchAId?.slice(0, 8) || 'null'}, sourceB: ${match.sourceMatchBId?.slice(0, 8) || 'null'}`);
      });
      console.log('');
    });

    // Analyze winner bracket
    const winnerRounds = rounds.filter(r => r.bracketType === 'WINNER');
    console.log('=== Winner Bracket Summary ===');
    winnerRounds.forEach(r => {
      console.log(`  Depth ${r.depth}: ${r.matches.length} match(es)`);
    });

    // Analyze loser bracket
    const loserRounds = rounds.filter(r => r.bracketType === 'LOSER');
    console.log('\n=== Loser Bracket Summary ===');
    loserRounds.forEach(r => {
      console.log(`  Depth ${r.depth}: ${r.matches.length} match(es)`);
    });

    // Analyze finals
    const finalsRounds = rounds.filter(r => r.bracketType === 'FINALS');
    console.log('\n=== Finals Summary ===');
    finalsRounds.forEach(r => {
      console.log(`  Depth ${r.depth}: ${r.matches.length} match(es)`);
    });

    // Expected structure for 8 teams double elimination
    console.log('\n=== Expected Structure for 8 Teams ===');
    console.log('Winner Bracket (single elimination):');
    console.log('  Depth 3: 4 matches (quarterfinals)');
    console.log('  Depth 2: 2 matches (semifinals)');
    console.log('  Depth 1: 1 match (winner bracket final)');
    console.log('  Depth 0: (none - winner goes to finals)');
    console.log('\nLoser Bracket:');
    console.log('  Depth 6: 2 matches (losers from depth 3 WB)');
    console.log('  Depth 5: 2 matches');
    console.log('  Depth 4: 2 matches (losers from depth 2 WB join)');
    console.log('  Depth 3: 1 match');
    console.log('  Depth 2: 1 match (loser from depth 1 WB joins)');
    console.log('  Depth 1: 1 match');
    console.log('  Depth 0: 1 match (loser bracket final)');
    console.log('\nFinals:');
    console.log('  Depth 1: 1 match (WB champ vs LB champ)');
    console.log('  Depth 0: 1 match (bracket reset if needed)');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeBracketStructure();
