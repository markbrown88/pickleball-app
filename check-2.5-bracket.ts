import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check25Bracket() {
  try {
    // Find the Klyng Cup - Pickleplex tournament, Stop 1, Round 1, 2.5 bracket
    const stop = await prisma.stop.findFirst({
      where: {
        name: '1',
        tournament: {
          name: 'Klyng Cup - Pickleplex'
        }
      },
      include: {
        rounds: {
          where: { idx: 0 }, // Round 1
          include: {
            matches: {
              include: {
                teamA: { 
                  include: {
                    bracket: { select: { name: true } }
                  }
                },
                teamB: { 
                  include: {
                    bracket: { select: { name: true } }
                  }
                },
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

    if (!stop) {
      console.log('Stop not found');
      return;
    }

    console.log(`\n=== Stop: ${stop.name} (${stop.id}) ===`);

    for (const round of stop.rounds) {
      console.log(`\nRound ${round.idx + 1}:`);
      
      for (const match of round.matches) {
        // Check if this is a 2.5 bracket match
        const teamABracket = match.teamA?.bracket?.name;
        const teamBBracket = match.teamB?.bracket?.name;
        
        if (teamABracket?.includes('2.5') || teamBBracket?.includes('2.5')) {
          console.log(`\n2.5 Bracket Match: ${match.teamA?.name} vs ${match.teamB?.name}`);
          console.log(`Team A Bracket: ${teamABracket}`);
          console.log(`Team B Bracket: ${teamBBracket}`);
          
          for (const game of match.games) {
            console.log(`\n${game.slot}:`);
            console.log('Team A Lineup:', JSON.stringify(game.teamALineup, null, 2));
            console.log('Team B Lineup:', JSON.stringify(game.teamBLineup, null, 2));
          }
        }
      }
    }

  } catch (error) {
    console.error('Error checking 2.5 bracket:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check25Bracket();
