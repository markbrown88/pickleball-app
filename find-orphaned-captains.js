const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findOrphanedCaptains() {
  try {
    console.log('Looking for teams with captain IDs that reference deleted users...\n');

    // Find all teams with captain IDs
    const teamsWithCaptains = await prisma.team.findMany({
      where: {
        captainId: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        tournamentId: true,
        clubId: true,
        captainId: true,
        tournament: {
          select: {
            name: true
          }
        },
        club: {
          select: {
            name: true
          }
        }
      }
    });

    console.log(`Found ${teamsWithCaptains.length} teams with captain assignments\n`);

    // Check which captain IDs still exist in the Player table
    const captainIds = [...new Set(teamsWithCaptains.map(t => t.captainId).filter(Boolean))];
    console.log(`Checking ${captainIds.length} unique captain IDs...\n`);

    const existingPlayers = await prisma.player.findMany({
      where: {
        id: {
          in: captainIds
        }
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    const existingPlayerIds = new Set(existingPlayers.map(p => p.id));
    console.log(`Found ${existingPlayerIds.size} captain IDs that still exist in Player table\n`);

    // Find orphaned captains
    const orphanedTeams = teamsWithCaptains.filter(team => 
      team.captainId && !existingPlayerIds.has(team.captainId)
    );

    console.log(`\n🚨 FOUND ${orphanedTeams.length} TEAMS WITH ORPHANED CAPTAIN REFERENCES:\n`);
    
    if (orphanedTeams.length > 0) {
      orphanedTeams.forEach((team, index) => {
        console.log(`${index + 1}. Team: "${team.name}"`);
        console.log(`   Tournament: ${team.tournament?.name || 'Unknown'}`);
        console.log(`   Club: ${team.club?.name || 'Unknown'}`);
        console.log(`   Orphaned Captain ID: ${team.captainId}`);
        console.log(`   Team ID: ${team.id}`);
        console.log('');
      });

      console.log('\n📊 SUMMARY:');
      console.log(`- Total teams with captains: ${teamsWithCaptains.length}`);
      console.log(`- Teams with valid captains: ${teamsWithCaptains.length - orphanedTeams.length}`);
      console.log(`- Teams with orphaned captains: ${orphanedTeams.length}`);
    } else {
      console.log('✅ No orphaned captain references found!');
    }

    // Also check TournamentCaptain table
    console.log('\n🔍 Checking TournamentCaptain table...\n');
    
    const tournamentCaptains = await prisma.tournamentCaptain.findMany({
      select: {
        tournamentId: true,
        clubId: true,
        playerId: true,
        tournament: {
          select: {
            name: true
          }
        },
        club: {
          select: {
            name: true
          }
        }
      }
    });

    const orphanedTournamentCaptains = tournamentCaptains.filter(tc => 
      !existingPlayerIds.has(tc.playerId)
    );

    console.log(`Found ${orphanedTournamentCaptains.length} orphaned TournamentCaptain records:\n`);
    
    if (orphanedTournamentCaptains.length > 0) {
      orphanedTournamentCaptains.forEach((tc, index) => {
        console.log(`${index + 1}. Tournament: ${tc.tournament?.name || 'Unknown'}`);
        console.log(`   Club: ${tc.club?.name || 'Unknown'}`);
        console.log(`   Orphaned Player ID: ${tc.playerId}`);
        console.log('');
      });
    } else {
      console.log('✅ No orphaned TournamentCaptain records found!');
    }

  } catch (error) {
    console.error('Error finding orphaned captains:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findOrphanedCaptains();
