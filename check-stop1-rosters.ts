import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stop1Id = 'cmfot1xyc0006rd6akzrbmapv';

  const rosters = await prisma.stopTeamPlayer.findMany({
    where: { stopId: stop1Id },
    include: {
      player: true,
      team: { include: { club: true } },
    },
  });

  console.log(`Stop 1 Total Roster Entries: ${rosters.length}\n`);

  // Group by team
  const teamRosters = new Map<string, any[]>();
  for (const r of rosters) {
    const teamName = r.team.club?.name || r.team.name;
    if (!teamRosters.has(teamName)) {
      teamRosters.set(teamName, []);
    }
    teamRosters.get(teamName)!.push(r);
  }

  for (const [teamName, players] of teamRosters.entries()) {
    console.log(`${teamName} (${players.length} players):`);
    for (const p of players.slice(0, 5)) {
      console.log(`  - ${p.player.firstName} ${p.player.lastName}`);
    }
    if (players.length > 5) {
      console.log(`  ... and ${players.length - 5} more`);
    }
    console.log();
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
