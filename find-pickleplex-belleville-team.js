const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pickleplex = 'cmfwjxyqn0001rdxtr8v9fmdj'; // Pickleplex Belleville
  const tournamentId = 'cmfot1xt50000rd6a1gvw8ozn'; // KLYNG CUP-GRAND
  const firstStopId = 'cmfot1xyc0006rd6akzrbmapv'; // Stop 1

  // Find Pickleplex Belleville team in this tournament
  const team = await prisma.team.findFirst({
    where: {
      tournamentId: tournamentId,
      clubId: pickleplex
    },
    include: {
      club: true
    }
  });

  console.log('Pickleplex Belleville Team:', JSON.stringify(team, null, 2));

  if (team) {
    // Check if they participated in Stop 1
    const stopTeam = await prisma.stopTeam.findFirst({
      where: {
        stopId: firstStopId,
        teamId: team.id
      }
    });

    console.log('\nStop 1 Participation:', JSON.stringify(stopTeam, null, 2));

    // Check their matches in Stop 1
    const stop = await prisma.stop.findUnique({
      where: { id: firstStopId },
      include: {
        rounds: {
          include: {
            matches: {
              where: {
                OR: [
                  { teamAId: team.id },
                  { teamBId: team.id }
                ]
              }
            }
          }
        }
      }
    });

    console.log('\nStop 1 Rounds and Matches:', JSON.stringify(stop, null, 2));
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
