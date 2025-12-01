import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

(async () => {
  const tournaments = await prisma.tournament.findMany({
    where: {
      OR: [
        { name: { contains: 'Grand', mode: 'insensitive' } },
        { name: { contains: 'Finale', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      type: true,
    },
  });

  console.log('Tournaments found:');
  tournaments.forEach(t => {
    console.log(`  - ${t.name} (${t.type})`);
  });

  await prisma.$disconnect();
})();

