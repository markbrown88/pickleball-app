import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function findTournament() {
  const tournaments = await prisma.tournament.findMany({
    where: {
      name: {
        contains: 'Grand',
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
      type: true,
    },
  });

  console.log('Tournaments with "Grand":', JSON.stringify(tournaments, null, 2));

  // Also list all tournaments
  const allTournaments = await prisma.tournament.findMany({
    select: {
      id: true,
      name: true,
      type: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  });

  console.log('\n\nRecent tournaments:');
  allTournaments.forEach(t => {
    console.log(`  - ${t.name} (${t.type})`);
  });

  await prisma.$disconnect();
}

findTournament();
