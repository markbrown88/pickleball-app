const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listStops() {
  const tournament = await prisma.tournament.findFirst({
    where: { name: 'KLYNG CUP - pickleplex' },
    include: {
      stops: {
        select: { id: true, name: true }
      }
    }
  });

  if (!tournament) {
    console.log('Tournament not found');
    return;
  }

  console.log('Tournament:', tournament.name);
  console.log('\nStops:');
  tournament.stops.forEach(s => console.log('  -', s.name));

  await prisma.$disconnect();
}

listStops().catch(console.error);
