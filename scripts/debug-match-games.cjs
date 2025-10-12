const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const matchId = 'cmgfnr3z9000gr0asfxhbiiq3';

  const games = await prisma.game.findMany({
    where: { matchId },
    orderBy: { slot: 'asc' }
  });

  console.log(JSON.stringify(games, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


