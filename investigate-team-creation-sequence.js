const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function investigateTeamCreationSequence() {
  try {
    // Find Fun Fest Tournament
    const tournament = await prisma.tournament.findFirst({
      where: { name: { contains: 'Fun Fest', mode: 'insensitive' } },
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
      console.log('Fun Fest Tournament not found');
      return;
    }

    console.log(`\n=== TEAM CREATION SEQUENCE ANALYSIS ===`);
    console.log(`Tournament: ${tournament.name} (${tournament.id})`);
    console.log(`Created: ${tournament.createdAt}`);

    // Group teams by creation time and type
    const teamsByType = {
      legacy: tournament.teams.filter(t => t.bracketId === null),
      bracket: tournament.teams.filter(t => t.bracketId !== null)
    };

    console.log(`\n--- LEGACY TEAMS (bracketId: NULL) ---`);
    console.log(`Count: ${teamsByType.legacy.length}`);
    
    const legacyByClub = {};
    teamsByType.legacy.forEach(team => {
      if (!legacyByClub[team.clubId]) {
        legacyByClub[team.clubId] = [];
      }
      legacyByClub[team.clubId].push(team);
    });

    Object.entries(legacyByClub).forEach(([clubId, teams]) => {
      const club = tournament.clubs.find(c => c.clubId === clubId);
      console.log(`\n${club?.club.name || 'Unknown'} (${clubId}):`);
      teams.forEach((team, idx) => {
        console.log(`  ${idx + 1}. ${team.name} - Created: ${team.createdAt} - Division: ${team.division}`);
      });
    });

    console.log(`\n--- BRACKET TEAMS (bracketId: DEFAULT) ---`);
    console.log(`Count: ${teamsByType.bracket.length}`);
    
    const bracketByClub = {};
    teamsByType.bracket.forEach(team => {
      if (!bracketByClub[team.clubId]) {
        bracketByClub[team.clubId] = [];
      }
      bracketByClub[team.clubId].push(team);
    });

    Object.entries(bracketByClub).forEach(([clubId, teams]) => {
      const club = tournament.clubs.find(c => c.clubId === clubId);
      console.log(`\n${club?.club.name || 'Unknown'} (${clubId}):`);
      teams.forEach((team, idx) => {
        console.log(`  ${idx + 1}. ${team.name} - Created: ${team.createdAt} - Bracket: ${team.bracket?.name || 'NULL'}`);
      });
    });

    // Analyze creation patterns
    console.log(`\n--- CREATION PATTERN ANALYSIS ---`);
    
    const creationTimes = tournament.teams.map(t => ({
      name: t.name,
      clubId: t.clubId,
      bracketId: t.bracketId,
      createdAt: t.createdAt,
      type: t.bracketId === null ? 'legacy' : 'bracket'
    })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    console.log('\nChronological team creation:');
    creationTimes.forEach((team, idx) => {
      const club = tournament.clubs.find(c => c.clubId === team.clubId);
      console.log(`${idx + 1}. ${team.createdAt.toISOString()} - ${club?.club.name || 'Unknown'} - ${team.name} (${team.type})`);
    });

    // Check for duplicate patterns
    console.log(`\n--- DUPLICATE PATTERN ANALYSIS ---`);
    
    const duplicates = {};
    creationTimes.forEach(team => {
      const key = `${team.clubId}-${team.type}`;
      if (!duplicates[key]) {
        duplicates[key] = [];
      }
      duplicates[key].push(team);
    });

    Object.entries(duplicates).forEach(([key, teams]) => {
      if (teams.length > 1) {
        const club = tournament.clubs.find(c => c.clubId === teams[0].clubId);
        console.log(`\n${club?.club.name || 'Unknown'} - ${teams[0].type} teams (${teams.length}):`);
        teams.forEach((team, idx) => {
          console.log(`  ${idx + 1}. ${team.createdAt.toISOString()} - ${team.name}`);
        });
      }
    });

  } catch (error) {
    console.error('Error investigating team creation sequence:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateTeamCreationSequence();





