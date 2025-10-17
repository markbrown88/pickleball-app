const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function investigateFunFest() {
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

    console.log(`\n=== FUN FEST TOURNAMENT INVESTIGATION ===`);
    console.log(`Tournament ID: ${tournament.id}`);
    console.log(`Tournament Name: ${tournament.name}`);
    console.log(`Created: ${tournament.createdAt}`);
    console.log(`Max Team Size: ${tournament.maxTeamSize}`);

    console.log(`\n--- BRACKETS (${tournament.brackets.length}) ---`);
    tournament.brackets.forEach((bracket, idx) => {
      console.log(`${idx + 1}. ID: ${bracket.id}, Name: "${bracket.name}", Index: ${bracket.idx}`);
    });

    console.log(`\n--- CLUBS (${tournament.clubs.length}) ---`);
    tournament.clubs.forEach((club, idx) => {
      console.log(`${idx + 1}. ID: ${club.clubId}, Name: "${club.club.name}"`);
    });

    console.log(`\n--- TEAMS (${tournament.teams.length}) ---`);
    const teamsByClub = {};
    tournament.teams.forEach((team, idx) => {
      if (!teamsByClub[team.clubId]) {
        teamsByClub[team.clubId] = [];
      }
      teamsByClub[team.clubId].push(team);
    });

    Object.entries(teamsByClub).forEach(([clubId, teams]) => {
      const club = tournament.clubs.find(c => c.clubId === clubId);
      console.log(`\nClub: ${club?.club.name || 'Unknown'} (${clubId})`);
      teams.forEach((team, idx) => {
        console.log(`  ${idx + 1}. Team ID: ${team.id}`);
        console.log(`     Name: "${team.name}"`);
        console.log(`     Bracket: ${team.bracket?.name || 'NULL'} (${team.bracketId || 'NULL'})`);
        console.log(`     Created: ${team.createdAt}`);
        console.log(`     Division: ${team.division}`);
      });
    });

    // Check for duplicate teams
    console.log(`\n--- DUPLICATE ANALYSIS ---`);
    const duplicateTeams = tournament.teams.filter((team, idx, arr) => 
      arr.findIndex(t => t.clubId === team.clubId && t.bracketId === team.bracketId) !== idx
    );

    if (duplicateTeams.length > 0) {
      console.log(`Found ${duplicateTeams.length} duplicate teams:`);
      duplicateTeams.forEach(team => {
        console.log(`  - ${team.name} (Club: ${team.clubId}, Bracket: ${team.bracketId})`);
      });
    } else {
      console.log('No duplicate teams found');
    }

  } catch (error) {
    console.error('Error investigating Fun Fest:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateFunFest();

