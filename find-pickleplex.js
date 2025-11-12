const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find Pickleplex Belleville club
  const clubs = await prisma.club.findMany({
    where: {
      OR: [
        { name: { contains: 'Pickleplex', mode: 'insensitive' } },
        { fullName: { contains: 'Pickleplex', mode: 'insensitive' } }
      ]
    }
  });

  console.log('Pickleplex Clubs:', JSON.stringify(clubs, null, 2));

  // Find the tournament
  const tournament = await prisma.tournament.findFirst({
    where: {
      name: { contains: 'Klyng Cup', mode: 'insensitive' }
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

  console.log('\nTournament:', JSON.stringify(tournament, null, 2));

  // Check what standing points exist
  const standings = await prisma.$queryRaw`
    SELECT * FROM tournament_standings
    WHERE "tournamentId" = ${tournament.id}
    ORDER BY points DESC
  `;

  console.log('\nCurrent standings:', JSON.stringify(standings, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
