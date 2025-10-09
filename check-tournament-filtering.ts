import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTournamentFiltering() {
  console.log('🔍 Checking tournament filtering in standings...\n');

  try {
    // Find the Klyng tournament
    const klyngTournament = await prisma.tournament.findFirst({
      where: {
        name: {
          contains: 'Klyng',
          not: {
            contains: 'pickleplex'
          }
        }
      },
      select: { id: true, name: true }
    });

    if (!klyngTournament) {
      console.log('❌ Klyng tournament not found');
      return;
    }

    console.log(`📊 Tournament: ${klyngTournament.name} (${klyngTournament.id})\n`);

    // Check what the materialized view shows for this specific tournament
    console.log('🔍 Materialized view for Klyng tournament only:');
    const tournamentStandings = await prisma.$queryRaw`
      SELECT 
        team_name,
        points,
        wins,
        losses,
        matches_played
      FROM tournament_standings 
      WHERE "tournamentId" = ${klyngTournament.id}
      ORDER BY points DESC, team_name ASC
    `;

    console.log(`Found ${(tournamentStandings as any[]).length} teams for Klyng tournament:`);
    console.table(tournamentStandings);

    // Check 4 Fathers Advanced specifically for this tournament
    const team = await prisma.team.findFirst({
      where: { name: '4 Fathers Advanced' },
      select: { id: true, name: true }
    });

    if (team) {
      console.log(`\n🏆 4 Fathers Advanced in Klyng tournament:`);
      const teamStanding = await prisma.$queryRaw`
        SELECT * FROM tournament_standings 
        WHERE team_id = ${team.id} AND "tournamentId" = ${klyngTournament.id}
      `;

      if (teamStanding && (teamStanding as any[]).length > 0) {
        const data = (teamStanding as any[])[0];
        console.log(`   Points: ${data.points}`);
        console.log(`   Wins: ${data.wins}`);
        console.log(`   Losses: ${data.losses}`);
        console.log(`   Matches Played: ${data.matches_played}`);
      } else {
        console.log('   ❌ No data found for 4 Fathers Advanced in Klyng tournament');
      }
    }

    // Check if there are other tournaments that might be affecting the calculation
    console.log('\n🔍 All tournaments in the system:');
    const allTournaments = await prisma.tournament.findMany({
      select: { id: true, name: true }
    });

    console.log(`Found ${allTournaments.length} tournaments:`);
    allTournaments.forEach(t => {
      console.log(`   ${t.name} (${t.id})`);
    });

    // Check if 4 Fathers Advanced appears in other tournaments
    console.log('\n🔍 4 Fathers Advanced across all tournaments:');
    const allTeamStandings = await prisma.$queryRaw`
      SELECT 
        "tournamentId",
        team_name,
        points,
        wins,
        losses
      FROM tournament_standings 
      WHERE team_id = ${team?.id}
      ORDER BY "tournamentId"
    `;

    console.log(`Found ${(allTeamStandings as any[]).length} tournament entries for 4 Fathers Advanced:`);
    (allTeamStandings as any[]).forEach(standing => {
      console.log(`   Tournament ${standing.tournamentId}: ${standing.points} points (${standing.wins}W-${standing.losses}L)`);
    });

    // Check if the API is filtering correctly
    console.log('\n🌐 Testing API endpoint logic:');
    console.log(`   API should filter by tournamentId: ${klyngTournament.id}`);
    console.log(`   This should only return standings for the Klyng tournament`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTournamentFiltering();
