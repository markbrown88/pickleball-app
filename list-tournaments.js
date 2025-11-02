const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listTournaments() {
  const tournaments = await prisma.tournament.findMany({
    select: { id: true, name: true }
  });

  console.log('All tournaments:');
  tournaments.forEach(t => console.log('  -', t.name));

  await prisma.$disconnect();
}

listTournaments().catch(console.error);
