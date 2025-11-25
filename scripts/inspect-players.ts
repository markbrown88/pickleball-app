import { prisma } from '../src/lib/prisma';

const ids = process.argv.slice(2);

if (ids.length === 0) {
  console.error('Pass player IDs as arguments');
  process.exit(1);
}

async function main() {
  const players = await prisma.player.findMany({
    where: { id: { in: ids } },
    include: {
      club: { select: { id: true, name: true } },
      stopRosterLinks: {
        select: { stopId: true, teamId: true, playerId: true, paymentMethod: true },
      },
      lineupEntriesAsP1: {
        select: { id: true, slot: true, lineup: { select: { id: true, roundId: true } } },
      },
      lineupEntriesAsP2: {
        select: { id: true, slot: true, lineup: { select: { id: true, roundId: true } } },
      },
      teamLinks: { select: { teamId: true } },
      tournamentRegistrations: { select: { id: true, tournamentId: true, status: true } },
    },
  });

  console.log(JSON.stringify(players, null, 2));
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

