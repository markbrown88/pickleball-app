import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCurrentStorage() {
  try {
    // Get a sample of players to see how data is currently stored
    const samplePlayers = await prisma.player.findMany({
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        birthday: true,
        birthdayYear: true,
        birthdayMonth: true,
        birthdayDay: true,
        email: true,
      },
      take: 5,
    });

    console.log('Sample of current player data storage:\n');
    samplePlayers.forEach((p, idx) => {
      console.log(`Player ${idx + 1}:`);
      console.log(`  ID: ${p.id}`);
      console.log(`  name: ${p.name || '(null)'}`);
      console.log(`  firstName: ${p.firstName || '(null)'}`);
      console.log(`  lastName: ${p.lastName || '(null)'}`);
      console.log(`  birthday: ${p.birthday || '(null)'}`);
      console.log(`  birthdayYear: ${p.birthdayYear || '(null)'}`);
      console.log(`  birthdayMonth: ${p.birthdayMonth || '(null)'}`);
      console.log(`  birthdayDay: ${p.birthdayDay || '(null)'}`);
      console.log('');
    });

    // Check if any players have birthday data
    const playersWithBirthday = await prisma.player.findMany({
      where: {
        OR: [
          { birthday: { not: null } },
          { birthdayYear: { not: null } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthday: true,
        birthdayYear: true,
        birthdayMonth: true,
        birthdayDay: true,
      },
      take: 3,
    });

    console.log('\nPlayers with birthday data:');
    playersWithBirthday.forEach((p) => {
      console.log(`  ${p.firstName} ${p.lastName}:`);
      console.log(`    birthday (DateTime): ${p.birthday || '(null)'}`);
      console.log(`    birthdayYear: ${p.birthdayYear || '(null)'}`);
      console.log(`    birthdayMonth: ${p.birthdayMonth || '(null)'}`);
      console.log(`    birthdayDay: ${p.birthdayDay || '(null)'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentStorage();

