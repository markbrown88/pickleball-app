import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Searching for Klyng tournaments ===\n');

  const tournaments = await prisma.tournament.findMany({
    where: {
      name: {
        contains: 'klyng',
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      name: true,
      type: true,
      _count: {
        select: {
          brackets: true,
          stops: true,
          clubs: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (tournaments.length === 0) {
    console.log('No tournaments found with "klyng" in the name.');
    console.log('\nLet me show all tournaments:');

    const allTournaments = await prisma.tournament.findMany({
      select: {
        id: true,
        name: true,
        type: true,
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    });

    allTournaments.forEach((t, idx) => {
      console.log(`${idx + 1}. ${t.name} (${t.type})`);
      console.log(`   ID: ${t.id}`);
    });
  } else {
    console.log(`Found ${tournaments.length} tournament(s):\n`);
    tournaments.forEach((t, idx) => {
      console.log(`${idx + 1}. ${t.name}`);
      console.log(`   ID: ${t.id}`);
      console.log(`   Type: ${t.type}`);
      console.log(`   Brackets: ${t._count.brackets}`);
      console.log(`   Stops: ${t._count.stops}`);
      console.log(`   Clubs: ${t._count.clubs}`);
      console.log();
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
