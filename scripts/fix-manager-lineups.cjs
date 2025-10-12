const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const stopId = 'cmftqlrha000crd1estw0n0a6'; // Stop 1
  const roundId = 'cmgfnr3xd000br0as15y59e1s'; // Round 2
  const teamAId = 'cmftqlrqb000mrd1ehlf4r2ql'; // Pickleplex Barrie 2.5
  const teamBId = 'cmftqnlsu000rrd1et3mt3g2d'; // Pickleplex Oshawa 2.5

  // Validate that both teams exist for the stop
  const stopTeams = await prisma.stopTeam.findMany({
    where: {
      stopId,
      teamId: {
        in: [teamAId, teamBId],
      },
    },
  });

  if (stopTeams.length < 2) {
    console.log('Missing stop-team link. Creating entries...');
    const missing = [];
    if (!stopTeams.find((st) => st.teamId === teamAId)) {
      missing.push(teamAId);
    }
    if (!stopTeams.find((st) => st.teamId === teamBId)) {
      missing.push(teamBId);
    }

    if (missing.length > 0) {
      await prisma.stopTeam.createMany({
        data: missing.map((teamId) => ({ stopId, teamId })),
        skipDuplicates: true,
      });
      console.log('Created stop-team links for:', missing);
    }
  }

  console.log('Stop-team links verified. Ready to save lineups.');
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

