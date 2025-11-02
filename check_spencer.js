const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSpencer() {
  try {
    const spencer = await prisma.player.findFirst({
      where: {
        OR: [
          { name: { contains: 'Spencer Carrick', mode: 'insensitive' } },
          { firstName: { contains: 'Spencer', mode: 'insensitive' }, lastName: { contains: 'Carrick', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        isAppAdmin: true,
        disabled: true
      }
    });

    if (spencer) {
      console.log('Found Spencer Carrick:');
      console.log(spencer);
    } else {
      console.log('Could not find a player named Spencer Carrick.');
    }
  } catch (error) {
    console.error('Error fetching player:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpencer();

