const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const token = 'vycxv';

  const tournamentClub = await prisma.tournamentClub.findUnique({
    where: { captainAccessToken: token },
    include: {
      club: true,
      tournament: true,
    },
  });

  console.log('tournamentClub', tournamentClub);

  if (!tournamentClub) {
    return;
  }

  const teams = await prisma.team.findMany({
    where: {
      tournamentId: tournamentClub.tournamentId,
      clubId: tournamentClub.clubId,
    },
    include: {
      bracket: true,
    },
  });

  console.log('teams', teams);
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

