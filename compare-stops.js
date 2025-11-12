const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function compareStops() {
  try {
    console.log('🏓 Comparing Stop 2 vs Stop 3 for Klyng Cup...\n');

    // Find the main Klyng Cup tournament
    const tournament = await prisma.tournament.findFirst({
      where: {
        name: {
          equals: 'Klyng Cup',
          mode: 'insensitive'
        }
      }
    });

    if (!tournament) {
      console.log('❌ Klyng Cup tournament not found');
      return;
    }

    // Find Stop 2 and Stop 3
    const stops = await prisma.stop.findMany({
      where: {
        tournamentId: tournament.id,
        OR: [
          { name: { contains: '2', mode: 'insensitive' } },
          { name: { contains: '3', mode: 'insensitive' } }
        ]
      },
      include: {
        rounds: {
          include: {
            matches: {
              include: {
                teamA: {
                  include: {
                    club: { select: { name: true } },
                    bracket: { select: { name: true } }
                  }
                },
                teamB: {
                  include: {
                    club: { select: { name: true } },
                    bracket: { select: { name: true } }
                  }
                },
                games: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log(`📍 Found ${stops.length} stops\n`);

    stops.forEach((stop, index) => {
      const totalMatches = stop.rounds.reduce((sum, round) => sum + round.matches.length, 0);
      const totalGames = stop.rounds.reduce((sum, round) => 
        sum + round.matches.reduce((matchSum, match) => matchSum + match.games.length, 0), 0);
      
      const completedGames = stop.rounds.reduce((sum, round) => 
        sum + round.matches.reduce((matchSum, match) => 
          matchSum + match.games.filter(game => game.teamAScore !== null && game.teamBScore !== null).length, 0), 0);

      console.log(`📊 ${stop.name}:`);
      console.log(`   - Rounds: ${stop.rounds.length}`);
      console.log(`   - Total matches: ${totalMatches}`);
      console.log(`   - Total games: ${totalGames}`);
      console.log(`   - Completed games: ${completedGames}`);
      console.log(`   - Completion rate: ${totalGames > 0 ? (completedGames / totalGames * 100).toFixed(1) : 0}%`);
      console.log(`   - Dates: ${stop.startAt} to ${stop.endAt}`);
      
      // Show some sample matches
      if (stop.rounds.length > 0 && stop.rounds[0].matches.length > 0) {
        console.log(`   - Sample matches:`);
        stop.rounds[0].matches.slice(0, 3).forEach(match => {
          const teamAName = match.teamA?.name || 'TBD';
          const teamBName = match.teamB?.name || 'TBD';
          const completedGamesInMatch = match.games.filter(g => g.teamAScore !== null && g.teamBScore !== null).length;
          console.log(`     • ${teamAName} vs ${teamBName} (${completedGamesInMatch}/${match.games.length} games completed)`);
        });
      }
      console.log('');
    });

    // Compare the data
    if (stops.length >= 2) {
      const stop2 = stops.find(s => s.name.includes('2'));
      const stop3 = stops.find(s => s.name.includes('3'));
      
      if (stop2 && stop3) {
        console.log('🔍 COMPARISON:');
        console.log(`Stop 2 rounds: ${stop2.rounds.length} | Stop 3 rounds: ${stop3.rounds.length}`);
        
        const stop2Matches = stop2.rounds.reduce((sum, round) => sum + round.matches.length, 0);
        const stop3Matches = stop3.rounds.reduce((sum, round) => sum + round.matches.length, 0);
        console.log(`Stop 2 matches: ${stop2Matches} | Stop 3 matches: ${stop3Matches}`);
        
        const stop2Games = stop2.rounds.reduce((sum, round) => 
          sum + round.matches.reduce((matchSum, match) => matchSum + match.games.length, 0), 0);
        const stop3Games = stop3.rounds.reduce((sum, round) => 
          sum + round.matches.reduce((matchSum, match) => matchSum + match.games.length, 0), 0);
        console.log(`Stop 2 games: ${stop2Games} | Stop 3 games: ${stop3Games}`);
        
        const stop2Completed = stop2.rounds.reduce((sum, round) => 
          sum + round.matches.reduce((matchSum, match) => 
            matchSum + match.games.filter(game => game.teamAScore !== null && game.teamBScore !== null).length, 0), 0);
        const stop3Completed = stop3.rounds.reduce((sum, round) => 
          sum + round.matches.reduce((matchSum, match) => 
            matchSum + match.games.filter(game => game.teamAScore !== null && game.teamBScore !== null).length, 0), 0);
        console.log(`Stop 2 completed: ${stop2Completed} | Stop 3 completed: ${stop3Completed}`);
        
        console.log(`Stop 2 completion rate: ${stop2Games > 0 ? (stop2Completed / stop2Games * 100).toFixed(1) : 0}%`);
        console.log(`Stop 3 completion rate: ${stop3Games > 0 ? (stop3Completed / stop3Games * 100).toFixed(1) : 0}%`);
      }
    }

  } catch (error) {
    console.error('❌ Error comparing stops:', error);
  } finally {
    await prisma.$disconnect();
  }
}

compareStops();










