import { PrismaClient } from '@prisma/client';
import { formatPhoneForStorage } from '@/lib/phone';

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    select: { id: true, phone: true },
  });

  let updated = 0;
  for (const player of players) {
    if (!player.phone) continue;
    const formatted = formatPhoneForStorage(player.phone);
    if (formatted && formatted !== player.phone) {
      await prisma.player.update({
        where: { id: player.id },
        data: { phone: formatted },
      });
      updated += 1;
    }
  }

  console.log(`Updated ${updated} player phone numbers.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error normalizing player phones:', err);
  prisma.$disconnect();
  process.exit(1);
});
