const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findMatches() {
  try {
    // Find all matches between these two teams
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          {
            teamA: { name: 'Pickleplex Downsview 3.5' },
            teamB: { name: 'Pickleplex Barrie 3.5' }
          },
          {
            teamA: { name: 'Pickleplex Barrie 3.5' },
            teamB: { name: 'Pickleplex Downsview 3.5' }
          }
        ]
      },
      include: {
        teamA: { select: { name: true } },
        teamB: { select: { name: true } },
        round: {
          select: {
            idx: true,
            stop: { select: { name: true } }
          }
        },
        games: {
          orderBy: { slot: 'asc' },
          select: {
            slot: true,
            teamAScore: true,
            teamBScore: true,
            isComplete: true,
            startedAt: true
          }
        }
      },
      orderBy: {
        round: { idx: 'asc' }
      }
    });

    console.log('Found', matches.length, 'match(es) between Pickleplex Downsview 3.5 and Pickleplex Barrie 3.5');
    console.log('');

    matches.forEach((match, idx) => {
      console.log(`MATCH ${idx + 1}:`);
      console.log('  Match ID:', match.id);
      console.log('  Round:', match.round ? `Round ${match.round.idx + 1}` : 'Unknown');
      console.log('  Stop:', match.round?.stop?.name || 'Unknown');
      console.log('  Team A:', match.teamA?.name);
      console.log('  Team B:', match.teamB?.name);
      console.log('  matchStatus:', match.matchStatus || 'null');
      console.log('');
      console.log('  Games:');

      match.games.forEach(game => {
        const scoreStr = (game.teamAScore != null && game.teamBScore != null)
          ? `${game.teamAScore}-${game.teamBScore}`
          : 'No scores';
        const status = game.isComplete ? 'COMPLETE' : 'INCOMPLETE';
        console.log(`    ${game.slot}: ${scoreStr} [${status}]`);
      });

      console.log('');
      console.log('---');
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findMatches();
