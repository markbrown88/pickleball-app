import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const keepPlayerId = 'cmfpzuh3r0001rdut4ffs0kn8'; // markbrown8@gmail.com - App Admin
  const deletePlayerId = 'cmj1n7n070001l204a3uqgjfb'; // mark@lilyfair.com - duplicate

  console.log('Before deletion:');
  const before = await prisma.player.findMany({
    where: { id: { in: [keepPlayerId, deletePlayerId] } },
    select: { id: true, email: true, isAppAdmin: true, clerkUserId: true }
  });
  console.log(JSON.stringify(before, null, 2));

  // Delete the duplicate player
  console.log('\nDeleting duplicate player (mark@lilyfair.com)...');
  await prisma.player.delete({
    where: { id: deletePlayerId }
  });

  console.log('\nAfter deletion:');
  const after = await prisma.player.findMany({
    where: { id: keepPlayerId },
    select: { id: true, email: true, isAppAdmin: true, clerkUserId: true }
  });
  console.log(JSON.stringify(after, null, 2));

  console.log('\nDone! The duplicate player has been removed.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
