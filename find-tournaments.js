const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findTournaments() {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        name: { contains: 'pickleplex', mode: 'insensitive' }
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            teams: true,
            stops: true
          }
        }
      }
    });

    console.log('Tournaments with "pickleplex" in name:');
    console.log('');
    tournaments.forEach(t => {
      console.log('- ' + t.name);
      console.log('  ID:', t.id);
      console.log('  Teams:', t._count.teams, '| Stops:', t._count.stops);
      console.log('');
    });

    // Also look for Klyng Cup
    console.log('---');
    console.log('');
    const klyngTournaments = await prisma.tournament.findMany({
      where: {
        name: { contains: 'Klyng', mode: 'insensitive' }
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            teams: true,
            stops: true
          }
        }
      }
    });

    console.log('Tournaments with "Klyng" in name:');
    console.log('');
    klyngTournaments.forEach(t => {
      console.log('- ' + t.name);
      console.log('  ID:', t.id);
      console.log('  Teams:', t._count.teams, '| Stops:', t._count.stops);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findTournaments();
