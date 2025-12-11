import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { email: 'markbrown8@gmail.com' },
        { email: 'mark@lilyfair.com' }
      ]
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      clerkUserId: true,
      isAppAdmin: true
    }
  });

  console.log('Players found:');
  console.log(JSON.stringify(players, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
