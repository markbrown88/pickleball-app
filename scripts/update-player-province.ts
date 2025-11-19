import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.player.updateMany({
    data: {
      region: 'ON',
    },
  });

  console.log(`Updated province for ${result.count} players.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error updating provinces:', err);
  prisma.$disconnect();
  process.exit(1);
});
