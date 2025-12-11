import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const adminPlayerId = 'cmfpzuh3r0001rdut4ffs0kn8'; // markbrown8@gmail.com - keep this one
  const duplicatePlayerId = 'cmj1s6ts00001i6049uzvg2jj'; // mark@lilyfair.com - delete this
  const correctClerkUserId = 'user_343X6gGkXXlSyUAXpU7nOmkuRpp';

  console.log('Step 1: Delete the duplicate player...');
  await prisma.player.delete({
    where: { id: duplicatePlayerId }
  });
  console.log('Deleted duplicate player cmj1s6ts00001i6049uzvg2jj');

  console.log('\nStep 2: Update the admin player with correct Clerk user ID...');
  const updated = await prisma.player.update({
    where: { id: adminPlayerId },
    data: { clerkUserId: correctClerkUserId },
    select: { id: true, email: true, isAppAdmin: true, clerkUserId: true }
  });

  console.log('\nFinal result:');
  console.log(JSON.stringify(updated, null, 2));
  console.log('\nDone! You should now have App Admin access when logging in.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
