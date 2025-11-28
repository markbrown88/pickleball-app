import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function findJoanAndMelissa() {
  try {
    const joans = await prisma.player.findMany({
      where: {
        OR: [
          { firstName: { contains: 'joan', mode: 'insensitive' } },
          { firstName: { contains: 'joanne', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        phone: true,
        clerkUserId: true,
        city: true,
        region: true,
        duprDoubles: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' }
    });

    const melissas = await prisma.player.findMany({
      where: {
        firstName: { contains: 'melissa', mode: 'insensitive' }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        phone: true,
        clerkUserId: true,
        city: true,
        region: true,
        duprDoubles: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log('\n=== JOAN ACCOUNTS ===');
    console.log(JSON.stringify(joans, null, 2));
    
    console.log('\n=== MELISSA ACCOUNTS ===');
    console.log(JSON.stringify(melissas, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findJoanAndMelissa();

