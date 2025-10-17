const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeKlyngCup() {
  try {
    // Find Klyng Cup Tournament
    const tournament = await prisma.tournament.findFirst({
      where: { name: { contains: 'Klyng Cup', mode: 'insensitive' } },
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
      console.log('Klyng Cup Tournament not found');
      return;
    }

    console.log(`\n=== KLYNG CUP TOURNAMENT ANALYSIS ===`);
    console.log(`Tournament: ${tournament.name} (${tournament.id})`);
    console.log(`Created: ${tournament.createdAt}`);

    // Analyze team creation patterns
    const legacyTeams = tournament.teams.filter(t => t.bracketId === null);
    const bracketTeams = tournament.teams.filter(t => t.bracketId !== null);

    console.log(`\n--- LEGACY TEAMS ANALYSIS ---`);
    console.log(`Total legacy teams: ${legacyTeams.length}`);

    // Group by club and analyze patterns
    const legacyByClub = {};
    legacyTeams.forEach(team => {
      if (!legacyByClub[team.clubId]) {
        legacyByClub[team.clubId] = [];
      }
      legacyByClub[team.clubId].push(team);
    });

    Object.entries(legacyByClub).forEach(([clubId, teams]) => {
      const club = tournament.clubs.find(c => c.clubId === clubId);
      console.log(`\n${club?.club.name || 'Unknown'} (${clubId}):`);
      console.log(`  Total teams: ${teams.length}`);
      
      // Group by division
      const byDivision = {};
      teams.forEach(team => {
        if (!byDivision[team.division]) {
          byDivision[team.division] = [];
        }
        byDivision[team.division].push(team);
      });
      
      Object.entries(byDivision).forEach(([division, divTeams]) => {
        console.log(`    ${division}: ${divTeams.length} teams`);
        divTeams.forEach((team, idx) => {
          console.log(`      ${idx + 1}. ${team.name} - Created: ${team.createdAt}`);
        });
      });
    });

    // Analyze bracket teams
    console.log(`\n--- BRACKET TEAMS ANALYSIS ---`);
    console.log(`Total bracket teams: ${bracketTeams.length}`);

    const bracketByClub = {};
    bracketTeams.forEach(team => {
      if (!bracketByClub[team.clubId]) {
        bracketByClub[team.clubId] = [];
      }
      bracketByClub[team.clubId].push(team);
    });

    Object.entries(bracketByClub).forEach(([clubId, teams]) => {
      const club = tournament.clubs.find(c => c.clubId === clubId);
      console.log(`\n${club?.club.name || 'Unknown'} (${clubId}):`);
      console.log(`  Total teams: ${teams.length}`);
      teams.forEach((team, idx) => {
        console.log(`    ${idx + 1}. ${team.name} - Created: ${team.createdAt} - Bracket: ${team.bracket?.name || 'NULL'}`);
      });
    });

    // Check for duplicate patterns
    console.log(`\n--- DUPLICATE PATTERN ANALYSIS ---`);
    
    const duplicates = {};
    tournament.teams.forEach(team => {
      const key = `${team.clubId}-${team.division || 'bracket'}-${team.bracketId || 'null'}`;
      if (!duplicates[key]) {
        duplicates[key] = [];
      }
      duplicates[key].push(team);
    });

    Object.entries(duplicates).forEach(([key, teams]) => {
      if (teams.length > 1) {
        const club = tournament.clubs.find(c => c.clubId === teams[0].clubId);
        const division = teams[0].division || 'bracket';
        const bracket = teams[0].bracket?.name || 'null';
        console.log(`\n${club?.club.name || 'Unknown'} - ${division} - ${bracket} (${teams.length} teams):`);
        teams.forEach((team, idx) => {
          console.log(`  ${idx + 1}. ${team.createdAt.toISOString()} - ${team.name}`);
        });
      }
    });

  } catch (error) {
    console.error('Error analyzing Klyng Cup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeKlyngCup();

