const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all tournaments with "Klyng Cup" in the name
  const tournaments = await prisma.tournament.findMany({
    where: {
      name: {
        contains: 'Klyng',
        mode: 'insensitive'
      }
    },
    include: {
      stops: {
        orderBy: { startAt: 'asc' },
        take: 1,
        include: {
          club: true
        }
      }
    }
  });

  console.log('All Klyng Cup Tournaments:');
  tournaments.forEach(t => {
    console.log(`\nName: ${t.name}`);
    console.log(`ID: ${t.id}`);
    console.log(`Type: ${t.type}`);
    if (t.stops.length > 0) {
      console.log(`First Stop: ${t.stops[0].name} at ${t.stops[0].club?.name || 'No club'}`);
    }
  });

  // Find the one with "pickleplex" in name
  const pickeplexTourney = tournaments.find(t =>
    t.name.toLowerCase().includes('pickleplex')
  );

  if (pickeplexTourney) {
    console.log('\n\n=== PICKLEPLEX TOURNAMENT FOUND ===');
    console.log(JSON.stringify(pickeplexTourney, null, 2));

    // Get all teams
    const teams = await prisma.team.findMany({
      where: {
        tournamentId: pickeplexTourney.id
      },
      include: {
        club: true
      }
    });

    console.log('\n\nTeams in this tournament:');
    teams.forEach(team => {
      console.log(`- ${team.club.name} (Team ID: ${team.id}, Club ID: ${team.clubId})`);
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
