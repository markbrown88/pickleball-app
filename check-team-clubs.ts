import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tournament = await prisma.tournament.findFirst({
    where: { name: { contains: 'Klyng' } },
  });

  if (!tournament) return;

  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    include: {
      club: true,
    },
  });

  console.log('Teams and their clubs:');
  for (const team of teams) {
    const clubName = team.club?.name || 'NO CLUB';
    const playerCount = await prisma.player.count({
      where: { clubId: team.clubId },
    });
    console.log(`  Team: ${team.name} (${team.division}) - Club: ${clubName} (${playerCount} players)`);
  }

  // Check for clubs named Blue Zone, Wild Card, Rally, Real Pickleball
  const clubNames = ['Blue Zone', 'Wild Card', 'Rally', 'Real Pickleball'];
  console.log('\nSearching for specific clubs:');
  for (const name of clubNames) {
    const clubs = await prisma.club.findMany({
      where: {
        OR: [{ name: { contains: name } }, { fullName: { contains: name } }],
      },
    });

    for (const club of clubs) {
      const playerCount = await prisma.player.count({
        where: { clubId: club.id },
      });
      console.log(`  ${club.name} / ${club.fullName} (${club.id}) - ${playerCount} players`);
    }
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
