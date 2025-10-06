import { prisma } from './src/lib/prisma';

async function checkStop2() {
  // Find Stop 2 for Klyng tournament
  const stops = await prisma.stop.findMany({
    where: {
      tournament: {
        name: { contains: 'Klyng' }
      }
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          rounds: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log('Klyng tournament stops:', JSON.stringify(stops, null, 2));

  for (const stop of stops) {
    const lineupCount = await prisma.lineup.count({
      where: {
        round: { stopId: stop.id }
      }
    });
    console.log(`\nStop ${stop.name} (${stop.id}): ${lineupCount} lineups`);
  }
}

checkStop2().then(() => process.exit(0));
