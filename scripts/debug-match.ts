import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const matchId = 'cmftqoqo10008r433v4yjkkcf';

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      games: true,
      teamA: true,
      teamB: true,
    },
  });

  console.log(JSON.stringify(match, null, 2));
}

main().finally(() => prisma.$disconnect());


