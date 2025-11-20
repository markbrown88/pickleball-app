import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkFirstClub() {
  const clubs = await prisma.club.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  
  console.log('Clubs in alphabetical order:');
  clubs.forEach((c, i) => console.log(`${i+1}. ${c.name} (${c.id})`));
  
  const firstClub = clubs[0];
  console.log(`\nFirst club (default): ${firstClub.name} (${firstClub.id})`);
  
  await prisma.$disconnect();
}

checkFirstClub();

