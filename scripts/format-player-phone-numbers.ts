import { PrismaClient } from '@prisma/client';
import { formatPhoneForStorage } from '../src/lib/phone';

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      phone: { not: null },
    },
    select: {
      id: true,
      phone: true,
    },
  });

  let updated = 0;

  for (const player of players) {
    const formatted = formatPhoneForStorage(player.phone);
    const current = player.phone?.trim() || null;

    if (formatted && formatted !== current) {
      await prisma.player.update({
        where: { id: player.id },
        data: { phone: formatted },
      });
      updated += 1;
    }
  }

  console.log(`Normalized phone numbers for ${updated} players.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error formatting player phone numbers:', err);
  prisma.$disconnect();
  process.exit(1);
});

