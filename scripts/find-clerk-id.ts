import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const player = await prisma.player.findUnique({
    where: { clerkUserId: 'user_343X6gGkXXlSyUAXpU7nOmkuRpp' },
    select: { id: true, email: true, isAppAdmin: true, clerkUserId: true }
  });
  console.log('Player with clerkUserId user_343X6gGkXXlSyUAXpU7nOmkuRpp:');
  console.log(JSON.stringify(player, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
