import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Klyng tournament
  const tournament = await prisma.tournament.findFirst({
    where: { name: { contains: 'Klyng' } },
  });

  if (!tournament) {
    console.error('Tournament not found');
    return;
  }

  console.log('Tournament:', tournament.name, tournament.id);

  // Get stops
  const stops = await prisma.stop.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\nStops:');
  for (const stop of stops) {
    console.log(`  ${stop.name} (${stop.id})`);
  }

  // Check rounds
  const rounds = await prisma.round.findMany({
    where: {
      stop: {
        tournamentId: tournament.id,
      },
    },
    include: {
      stop: true,
      _count: {
        select: {
          lineups: true,
        },
      },
    },
  });

  console.log('\nRounds and Lineups:');
  for (const round of rounds) {
    console.log(`  ${round.stop.name} - Round ${round.idx + 1}: ${round._count.lineups} lineups`);
  }

  // Get lineup sample
  const lineup = await prisma.lineup.findFirst({
    include: {
      team: {
        include: {
          club: true,
        },
      },
      entries: {
        include: {
          player1: true,
          player2: true,
        },
      },
    },
  });

  if (lineup) {
    console.log('\nSample lineup:');
    console.log(`  Team: ${lineup.team.club?.name || lineup.team.name}`);
    console.log(`  Players:`);
    for (const entry of lineup.entries) {
      if (entry.player1) {
        console.log(`    - ${entry.player1.firstName} ${entry.player1.lastName} (ID: ${entry.player1.id})`);
      }
      if (entry.player2) {
        console.log(`    - ${entry.player2.firstName} ${entry.player2.lastName} (ID: ${entry.player2.id})`);
      }
    }
  }

  const stop1Id = stops[0]?.id;
  if (!stop1Id) return;

  const stop1Players = await prisma.stopTeamPlayer.findMany({
    where: { stopId: stop1Id },
    take: 20,
    include: {
      player: true,
      team: { include: { club: true } },
    },
  });

  console.log(`\nFound ${stop1Players.length} StopTeamPlayer records in Stop 1`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
