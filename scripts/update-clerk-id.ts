import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const playerId = 'cmfpzuh3r0001rdut4ffs0kn8';
  const newClerkUserId = 'user_343X6gGkXXlSyUAXpU7nOmkuRpp';

  console.log('Before update:');
  const before = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, email: true, isAppAdmin: true, clerkUserId: true }
  });
  console.log(JSON.stringify(before, null, 2));

  console.log('\nUpdating clerkUserId...');
  const updated = await prisma.player.update({
    where: { id: playerId },
    data: { clerkUserId: newClerkUserId },
    select: { id: true, email: true, isAppAdmin: true, clerkUserId: true }
  });

  console.log('\nAfter update:');
  console.log(JSON.stringify(updated, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
