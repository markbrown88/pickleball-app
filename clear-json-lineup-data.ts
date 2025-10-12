import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearJsonData() {
  try {
    console.log('Clearing old JSON lineup data from Game table...\n');

    const result = await prisma.game.updateMany({
      where: {
        OR: [
          { teamALineup: { not: null } },
          { teamBLineup: { not: null } }
        ]
      },
      data: {
        teamALineup: null,
        teamBLineup: null
      }
    });

    console.log(`✅ Cleared JSON data from ${result.count} games\n`);

    // Verify
    const remaining = await prisma.game.count({
      where: {
        OR: [
          { teamALineup: { not: null } },
          { teamBLineup: { not: null } }
        ]
      }
    });

    console.log(`Verification: ${remaining} games still have JSON data (should be 0)`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearJsonData();
