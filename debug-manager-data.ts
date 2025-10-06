import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugManagerData() {
  // Find Mike Blythe
  const mike = await prisma.player.findFirst({
    where: {
      firstName: { contains: 'Mike', mode: 'insensitive' },
      lastName: { contains: 'Blythe', mode: 'insensitive' }
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    }
  });

  if (!mike) {
    console.log('Mike not found');
    return;
  }

  console.log('\n=== MIKE BLYTHE ===');
  console.log('ID:', mike.id);

  // Find stops where Mike is event manager
  const stops = await prisma.stop.findMany({
    where: {
      eventManagerId: mike.id
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true
        }
      },
      rounds: {
        orderBy: { idx: 'asc' },
        include: {
          matches: {
            select: { id: true }
          }
        }
      }
    }
  });

  console.log('\n--- STOPS MANAGED ---');
  console.log(`Found ${stops.length} stops`);

  stops.forEach(stop => {
    console.log(`\nStop: ${stop.name}`);
    console.log(`  Tournament: ${stop.tournament.name}`);
    console.log(`  Rounds: ${stop.rounds.length}`);
    stop.rounds.forEach(round => {
      console.log(`    Round ${round.idx}: ${round.matches.length} matches`);
    });
  });

  // Check TournamentEventManager
  const tournamentEM = await prisma.tournamentEventManager.findMany({
    where: {
      playerId: mike.id
    },
    include: {
      Tournament: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  console.log('\n--- TOURNAMENT EVENT MANAGER ---');
  console.log(`Found ${tournamentEM.length} tournament-level assignments`);
  tournamentEM.forEach(em => {
    console.log(`  Tournament: ${em.Tournament.name}`);
  });

  await prisma.$disconnect();
}

debugManagerData();
