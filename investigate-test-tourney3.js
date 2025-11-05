const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function investigateTestTourney3() {
  try {
    // Find Test Tourney 3
    const tournament = await prisma.tournament.findFirst({
      where: { name: { contains: 'Test Tourney 3', mode: 'insensitive' } },
      include: {
        brackets: true,
        clubs: { include: { club: true } },
        teams: {
          include: {
            club: true,
            bracket: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!tournament) {
      console.log('Test Tourney 3 not found');
      return;
    }

    console.log(`\n=== TEST TOURNEY 3 INVESTIGATION ===`);
    console.log(`Tournament: ${tournament.name} (${tournament.id})`);
    console.log(`Created: ${tournament.createdAt}`);

    // Analyze brackets
    console.log(`\n--- BRACKETS ---`);
    if (tournament.brackets.length === 0) {
      console.log('No brackets found');
    } else {
      tournament.brackets.forEach((bracket, idx) => {
        console.log(`${idx + 1}. ${bracket.name} (${bracket.id}) - idx: ${bracket.idx}`);
      });
    }

    // Analyze teams
    const legacyTeams = tournament.teams.filter(t => t.bracketId === null);
    const bracketTeams = tournament.teams.filter(t => t.bracketId !== null);

    console.log(`\n--- TEAM ANALYSIS ---`);
    console.log(`Legacy teams (bracketId: NULL): ${legacyTeams.length}`);
    console.log(`Bracket teams (bracketId: DEFAULT): ${bracketTeams.length}`);
    console.log(`Total teams: ${tournament.teams.length}`);

    // Group by club and analyze patterns
    const teamsByClub = {};
    tournament.teams.forEach(team => {
      if (!teamsByClub[team.clubId]) {
        teamsByClub[team.clubId] = [];
      }
      teamsByClub[team.clubId].push(team);
    });

    console.log(`\n--- TEAMS BY CLUB ---`);
    Object.entries(teamsByClub).forEach(([clubId, teams]) => {
      const club = tournament.clubs.find(c => c.clubId === clubId);
      console.log(`\n${club?.club.name || 'Unknown'} (${clubId}):`);
      console.log(`  Total teams: ${teams.length}`);
      
      // Group by type
      const legacyCount = teams.filter(t => t.bracketId === null).length;
      const bracketCount = teams.filter(t => t.bracketId !== null).length;
      
      console.log(`  Legacy teams: ${legacyCount}`);
      console.log(`  Bracket teams: ${bracketCount}`);
      
      // Show team details
      teams.forEach((team, idx) => {
        const type = team.bracketId === null ? 'legacy' : 'bracket';
        const bracketName = team.bracket?.name || 'NULL';
        console.log(`    ${idx + 1}. ${team.name} - ${type} - Bracket: ${bracketName} - Created: ${team.createdAt}`);
      });
      
      if (teams.length > 1) {
        console.log(`  ⚠️  DUPLICATE ISSUE: ${teams.length} teams instead of 1`);
      } else {
        console.log(`  ✅ CORRECT: 1 team per club`);
      }
    });

    // Analyze creation timeline
    console.log(`\n--- CREATION TIMELINE ---`);
    const allTeams = tournament.teams.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    allTeams.forEach((team, idx) => {
      const club = tournament.clubs.find(c => c.clubId === team.clubId);
      const type = team.bracketId === null ? 'legacy' : 'bracket';
      const bracketName = team.bracket?.name || 'NULL';
      console.log(`${idx + 1}. ${team.createdAt.toISOString()} - ${club?.club.name || 'Unknown'} - ${team.name} (${type}, ${bracketName})`);
    });

    // Check for rapid creation patterns
    console.log(`\n--- RAPID CREATION ANALYSIS ---`);
    const rapidCreations = [];
    for (let i = 1; i < allTeams.length; i++) {
      const timeDiff = allTeams[i].createdAt - allTeams[i-1].createdAt;
      if (timeDiff < 5000) { // Less than 5 seconds
        rapidCreations.push({
          team1: allTeams[i-1],
          team2: allTeams[i],
          timeDiff: timeDiff
        });
      }
    }

    if (rapidCreations.length > 0) {
      console.log(`Found ${rapidCreations.length} rapid team creations (< 5 seconds apart):`);
      rapidCreations.forEach((rapid, idx) => {
        const club1 = tournament.clubs.find(c => c.clubId === rapid.team1.clubId);
        const club2 = tournament.clubs.find(c => c.clubId === rapid.team2.clubId);
        console.log(`  ${idx + 1}. ${club1?.club.name || 'Unknown'} -> ${club2?.club.name || 'Unknown'} (${rapid.timeDiff}ms)`);
        console.log(`     Team 1: ${rapid.team1.name} (${rapid.team1.bracketId ? 'bracket' : 'legacy'})`);
        console.log(`     Team 2: ${rapid.team2.name} (${rapid.team2.bracketId ? 'bracket' : 'legacy'})`);
      });
    } else {
      console.log('No rapid team creations found');
    }

  } catch (error) {
    console.error('Error investigating Test Tourney 3:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateTestTourney3();





