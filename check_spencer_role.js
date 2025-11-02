const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEventManager() {
  try {
    const spencer = await prisma.player.findFirst({
      where: {
        firstName: 'Spencer',
        lastName: 'Carrick'
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!spencer) {
      console.log('Could not find Spencer Carrick.');
      return;
    }

    const eventManagerEntries = await prisma.tournamentEventManager.findMany({
      where: {
        playerId: spencer.id
      },
      include: {
        Tournament: {
          select: {
            name: true
          }
        }
      }
    });

    if (eventManagerEntries.length > 0) {
      console.log('Spencer Carrick is an Event Manager for the following tournaments:');
      eventManagerEntries.forEach(entry => {
        console.log(`- ${entry.Tournament.name}`);
      });
    } else {
      console.log('Spencer Carrick is not an Event Manager for any tournaments.');
    }

  } catch (error) {
    console.error('Error checking event manager status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEventManager();

