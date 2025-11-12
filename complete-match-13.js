const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function completeMatch13() {
  try {
    console.log('=== Manually Completing Match 13 ===\n');

    // Find Match 13 (Loser Bracket Final with Pickering)
    const matches = await prisma.match.findMany({
      where: {
        round: {
          stop: {
            tournament: {
              name: { contains: 'Bracket Test 4' }
            }
          },
          bracketType: 'LOSER',
          depth: 0
        }
      },
      include: {
        round: {
          select: {
            bracketType: true,
            depth: true,
            stopId: true,
          }
        },
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        games: true,
      }
    });

    const match13 = matches.find(m => m.teamA?.name?.includes('Pickering'));

    if (!match13) {
      console.error('Match 13 not found!');
      return;
    }

    console.log('Match 13:');
    console.log(`  ID: ${match13.id}`);
    console.log(`  Teams: ${match13.teamA?.name} vs ${match13.teamB?.name || 'TBD'}`);
    console.log(`  Games: ${match13.games.length}`);
    console.log(`  Complete games: ${match13.games.filter(g => g.isComplete).length}`);

    // Calculate winner
    let teamAWins = 0;
    let teamBWins = 0;

    for (const game of match13.games) {
      if (!game.isComplete) continue;
      const teamAScore = game.teamAScore ?? 0;
      const teamBScore = game.teamBScore ?? 0;

      if (teamAScore > teamBScore) {
        teamAWins++;
      } else if (teamBScore > teamAScore) {
        teamBWins++;
      }
    }

    console.log(`\n  Game wins: Team A: ${teamAWins}, Team B: ${teamBWins}`);

    const winnerId = teamAWins > teamBWins ? match13.teamAId : match13.teamBId;
    const winnerName = teamAWins > teamBWins ? match13.teamA?.name : match13.teamB?.name;

    console.log(`  Winner: ${winnerName} (${winnerId})`);

    if (!winnerId) {
      console.error('Could not determine winner!');
      return;
    }

    // Call the complete endpoint
    console.log('\nCalling /api/admin/matches/[matchId]/complete...');

    const response = await fetch(`http://localhost:3000/api/admin/matches/${match13.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const result = await response.json();
      console.log('\n✅ Match completed successfully!');
      console.log('Result:', JSON.stringify(result, null, 2));
      console.log('\nMatch 13 should now advance its winner to Finals Match 14!');
    } else {
      const errorText = await response.text();
      console.error('\n❌ Failed to complete match:', response.status);
      console.error('Error:', errorText);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

completeMatch13();
