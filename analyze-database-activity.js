const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeDatabaseActivity() {
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

    console.log(`\n=== DATABASE ACTIVITY ANALYSIS ===`);
    console.log(`Tournament: ${tournament.name} (${tournament.id})`);

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
      
      // Analyze creation time patterns
      const creationTimes = teams.map(t => t.createdAt).sort();
      const timeDiffs = [];
      for (let i = 1; i < creationTimes.length; i++) {
        const diff = creationTimes[i] - creationTimes[i-1];
        timeDiffs.push(diff);
      }
      
      if (timeDiffs.length > 0) {
        const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
        console.log(`  Average time between creations: ${Math.round(avgDiff)}ms`);
        console.log(`  Time differences: ${timeDiffs.map(d => Math.round(d)).join(', ')}ms`);
      }
      
      // Check for duplicate names
      const names = teams.map(t => t.name);
      const uniqueNames = [...new Set(names)];
      if (names.length !== uniqueNames.length) {
        console.log(`  ⚠️  Duplicate team names found!`);
        const nameCounts = {};
        names.forEach(name => {
          nameCounts[name] = (nameCounts[name] || 0) + 1;
        });
        Object.entries(nameCounts).forEach(([name, count]) => {
          if (count > 1) {
            console.log(`    "${name}": ${count} times`);
          }
        });
      }
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

    // Check for potential race conditions
    console.log(`\n--- RACE CONDITION ANALYSIS ---`);
    
    // Look for teams created within very short time windows
    const allTeams = tournament.teams.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const rapidCreations = [];
    
    for (let i = 1; i < allTeams.length; i++) {
      const timeDiff = allTeams[i].createdAt - allTeams[i-1].createdAt;
      if (timeDiff < 1000) { // Less than 1 second
        rapidCreations.push({
          team1: allTeams[i-1],
          team2: allTeams[i],
          timeDiff: timeDiff
        });
      }
    }

    if (rapidCreations.length > 0) {
      console.log(`Found ${rapidCreations.length} rapid team creations (< 1 second apart):`);
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

    // Check for potential API call patterns
    console.log(`\n--- API CALL PATTERN ANALYSIS ---`);
    
    // Group teams by creation time windows (5-minute buckets)
    const timeBuckets = {};
    allTeams.forEach(team => {
      const bucket = Math.floor(team.createdAt.getTime() / (5 * 60 * 1000)); // 5-minute buckets
      if (!timeBuckets[bucket]) {
        timeBuckets[bucket] = [];
      }
      timeBuckets[bucket].push(team);
    });

    console.log('Team creation by 5-minute time buckets:');
    Object.entries(timeBuckets).forEach(([bucket, teams]) => {
      const startTime = new Date(parseInt(bucket) * 5 * 60 * 1000);
      const legacyCount = teams.filter(t => t.bracketId === null).length;
      const bracketCount = teams.filter(t => t.bracketId !== null).length;
      console.log(`  ${startTime.toISOString()}: ${teams.length} teams (${legacyCount} legacy, ${bracketCount} bracket)`);
    });

  } catch (error) {
    console.error('Error analyzing database activity:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeDatabaseActivity();










