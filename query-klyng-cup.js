const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tournament = await prisma.tournament.findFirst({
    where: {
      name: {
        contains: 'Klyng Cup',
        mode: 'insensitive'
      }
    },
    include: {
      stops: {
        orderBy: { startAt: 'asc' },
        include: {
          club: true
        }
      }
    }
  });

  console.log(JSON.stringify(tournament, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
