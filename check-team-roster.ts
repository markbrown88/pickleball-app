import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stopId = process.argv[3] || 'cmfot1xyc0006rd6akzrbmapv'; // Stop 1 by default
  const teamName = process.argv[2] || 'Greenhills';

  const rosters = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId,
      team: {
        club: {
          name: teamName,
        },
      },
    },
    include: {
      player: true,
    },
  });

  console.log(`${teamName} roster for stop ${stopId.slice(-5)} (${rosters.length} players):`);
  for (const r of rosters) {
    console.log(`  ${r.player.firstName} ${r.player.lastName}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
