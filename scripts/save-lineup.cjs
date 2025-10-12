const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const matchId = 'cmgfnr3z9000gr0asfxhbiiq3';

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      round: true,
      teamA: true,
      teamB: true,
      games: true,
    },
  });

  console.log(JSON.stringify(match, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


