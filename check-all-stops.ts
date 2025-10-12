import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllStops() {
  try {
    // Get all stops with lineup data
    const stops = await prisma.stop.findMany({
      where: {
        rounds: {
          some: {
            matches: {
              some: {
                games: {
                  some: {
                    OR: [
                      { teamALineup: { not: Prisma.JsonNull } },
                      { teamBLineup: { not: Prisma.JsonNull } }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      include: {
        tournament: { select: { name: true } },
        rounds: {
          include: {
            matches: {
              include: {
                teamA: { select: { id: true, name: true } },
                teamB: { select: { id: true, name: true } },
                games: {
                  select: {
                    id: true,
                    slot: true,
                    teamALineup: true,
                    teamBLineup: true
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`Found ${stops.length} stops with lineup data`);

    for (const stop of stops) {
      console.log(`\n=== Stop: ${stop.name} (${stop.id}) ===`);
      console.log(`Tournament: ${stop.tournament.name}`);

      let totalMatchesWithLineups = 0;
      for (const round of stop.rounds) {
        for (const match of round.matches) {
          const hasTeamALineup = match.games.some(g => g.teamALineup && Array.isArray(g.teamALineup) && g.teamALineup.length > 0);
          const hasTeamBLineup = match.games.some(g => g.teamBLineup && Array.isArray(g.teamBLineup) && g.teamBLineup.length > 0);
          
          if (hasTeamALineup || hasTeamBLineup) {
            totalMatchesWithLineups++;
            console.log(`  Match ${match.id}: ${match.teamA?.name} vs ${match.teamB?.name}`);
            
            // Check each game
            for (const game of match.games) {
              if (game.teamALineup && Array.isArray(game.teamALineup) && game.teamALineup.length > 0) {
                console.log(`    ${game.slot} Team A: ${game.teamALineup.length} players`);
              }
              if (game.teamBLineup && Array.isArray(game.teamBLineup) && game.teamBLineup.length > 0) {
                console.log(`    ${game.slot} Team B: ${game.teamBLineup.length} players`);
              }
            }
          }
        }
      }
      
      console.log(`  Total matches with lineups: ${totalMatchesWithLineups}`);
    }

  } catch (error) {
    console.error('Error checking stops:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllStops();
