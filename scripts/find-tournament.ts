import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function findTournament() {
  const tournaments = await prisma.tournament.findMany({
    where: {
      name: {
        contains: 'pickleplex',
        mode: 'insensitive',
      },
    },
    include: {
      stops: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  console.log(JSON.stringify(tournaments, null, 2));
  await prisma.$disconnect();
}

findTournament();

