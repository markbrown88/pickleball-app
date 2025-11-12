const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tournamentId = 'cmh7qeb1t0000ju04udwe7w8w'; // KLYNG CUP - pickleplex

  console.log('Checking standings after applying Belleville first-stop zero points rule...\n');

  // Get current standings
  const standings = await prisma.$queryRaw`
    SELECT * FROM tournament_standings
    WHERE "tournamentId" = ${tournamentId}
    ORDER BY points DESC, team_name
  `;

  console.log('Tournament Standings:');
  console.log('='.repeat(60));

  const bellevilleClubId = 'cmfwjxyqn0001rdxtr8v9fmdj';

  standings.forEach(s => {
    // Check if this is a Belleville team
    const isBelleville = s.clubId === bellevilleClubId;
    const marker = isBelleville ? ' <-- Pickleplex Belleville (First Stop = 0)' : '';

    console.log(`${s.team_name.padEnd(35)} | ${String(s.points).padStart(3)} pts | ${s.wins}W-${s.losses}L | ${s.matches_played} matches${marker}`);
  });

  console.log('='.repeat(60));
  console.log('\nNote: Pickleplex Belleville teams will receive 0 points from');
  console.log('all matches played in the first stop (Vaughn) of this tournament.');
  console.log('Points from subsequent stops will be calculated normally.');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
