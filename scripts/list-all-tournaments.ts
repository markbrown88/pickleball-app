import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listAllTournaments() {
  try {
    const tournaments = await prisma.tournament.findMany({
      select: {
        id: true,
        name: true,
        registrationStatus: true,
        startDate: true,
        endDate: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`\n📋 Found ${tournaments.length} tournaments in database:\n`);
    console.log('='.repeat(100));

    tournaments.forEach((t, index) => {
      console.log(`${index + 1}. ${t.name}`);
      console.log(`   ID: ${t.id}`);
      console.log(`   Status: ${t.registrationStatus}`);
      console.log(`   Dates: ${t.startDate || 'N/A'} → ${t.endDate || 'N/A'}`);
      console.log('');
    });

    console.log('='.repeat(100));

  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAllTournaments();
