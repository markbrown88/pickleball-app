const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tournamentNamesToDelete = ['Fun Fest', 'Test Tourney 17'];
  console.log(`Attempting to delete the following tournaments: ${tournamentNamesToDelete.join(', ')}`);

  // 1. Find the tournaments to delete
  const tournaments = await prisma.tournament.findMany({
    where: { name: { in: tournamentNamesToDelete } },
    select: { id: true, name: true },
  });

  if (tournaments.length === 0) {
    console.log('No matching tournaments found to delete.');
    return;
  }

  const tournamentIds = tournaments.map(t => t.id);
  console.log('Found the following tournaments to delete:');
  tournaments.forEach(t => console.log(`- ${t.name} (ID: ${t.id})`));

  // 2. Find all teams within those tournaments
  const teams = await prisma.team.findMany({
    where: { tournamentId: { in: tournamentIds } },
    select: { id: true },
  });
  const teamIds = teams.map(t => t.id);

  if (teamIds.length > 0) {
    // 3. Delete all matches associated with those teams
    console.log(`Found ${teamIds.length} teams. Deleting associated matches...`);
    const deletedMatches = await prisma.match.deleteMany({
      where: {
        OR: [
          { teamAId: { in: teamIds } },
          { teamBId: { in: teamIds } },
        ],
      },
    });
    console.log(`Deleted ${deletedMatches.count} matches.`);
  } else {
    console.log('No teams found for these tournaments, skipping match deletion.');
  }

  // 4. Now, delete the tournaments. The rest of the data should cascade.
  console.log('Deleting tournaments...');
  const result = await prisma.tournament.deleteMany({
    where: {
      id: { in: tournamentIds },
    },
  });

  console.log(`Successfully deleted ${result.count} tournament(s).`);
  console.log('Associated data should now be fully deleted.');
}

main()
  .catch((e) => {
    console.error('An error occurred during the deletion process:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
