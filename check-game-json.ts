import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGameJson() {
  try {
    const gameWithJSON = await prisma.game.findFirst({
      where: { teamALineup: { not: null } },
      select: { id: true, slot: true, teamALineup: true, teamBLineup: true }
    });

    console.log('Game with JSON lineup:', JSON.stringify(gameWithJSON, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGameJson();
