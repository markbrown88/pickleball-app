const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listKlyngCupCaptains() {
  try {
    console.log('Listing captains for Klyng Cup tournament...\n');

    // Find the Klyng Cup tournament
    const tournament = await prisma.tournament.findFirst({
      where: {
        name: {
          contains: 'Klyng Cup',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!tournament) {
      console.log('❌ Klyng Cup tournament not found');
      return;
    }

    console.log(`🏆 Tournament: ${tournament.name} (${tournament.id})\n`);

    // Get all teams with captains for this tournament
    const teamsWithCaptains = await prisma.team.findMany({
      where: {
        tournamentId: tournament.id,
        captainId: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        clubId: true,
        captainId: true,
        club: {
          select: {
            name: true,
            city: true,
            region: true
          }
        },
        captain: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { club: { name: 'asc' } },
        { name: 'asc' }
      ]
    });

    console.log(`Found ${teamsWithCaptains.length} teams with captains:\n`);

    if (teamsWithCaptains.length === 0) {
      console.log('No teams with captains found for this tournament.');
      return;
    }

    // Group by club for better organization
    const byClub = new Map();
    teamsWithCaptains.forEach(team => {
      const clubName = team.club?.name || 'Unknown Club';
      if (!byClub.has(clubName)) {
        byClub.set(clubName, []);
      }
      byClub.get(clubName).push(team);
    });

    // Display captains by club
    for (const [clubName, teams] of byClub) {
      console.log(`🏢 ${clubName}:`);
      teams.forEach((team, index) => {
        const captain = team.captain;
        const captainName = captain ? `${captain.firstName} ${captain.lastName}`.trim() || captain.name : 'Unknown';
        const captainEmail = captain?.email || 'No email';
        
        console.log(`   ${index + 1}. Team: "${team.name}"`);
        console.log(`      Captain: ${captainName} (${team.captainId})`);
        console.log(`      Email: ${captainEmail}`);
        console.log(`      Team ID: ${team.id}`);
        console.log('');
      });
    }

    // Also check TournamentCaptain table
    console.log('\n📋 TournamentCaptain records:\n');
    
    const tournamentCaptains = await prisma.tournamentCaptain.findMany({
      where: {
        tournamentId: tournament.id
      },
      select: {
        clubId: true,
        playerId: true,
        club: {
          select: {
            name: true,
            city: true,
            region: true
          }
        },
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        club: {
          name: 'asc'
        }
      }
    });

    if (tournamentCaptains.length === 0) {
      console.log('No TournamentCaptain records found.');
    } else {
      console.log(`Found ${tournamentCaptains.length} TournamentCaptain records:\n`);
      
      tournamentCaptains.forEach((tc, index) => {
        const player = tc.player;
        const playerName = player ? `${player.firstName} ${player.lastName}`.trim() || player.name : 'Unknown';
        const playerEmail = player?.email || 'No email';
        
        console.log(`${index + 1}. Club: ${tc.club?.name || 'Unknown'}`);
        console.log(`   Captain: ${playerName} (${tc.playerId})`);
        console.log(`   Email: ${playerEmail}`);
        console.log('');
      });
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`- Tournament: ${tournament.name}`);
    console.log(`- Teams with captains: ${teamsWithCaptains.length}`);
    console.log(`- TournamentCaptain records: ${tournamentCaptains.length}`);
    console.log(`- Unique clubs: ${byClub.size}`);

  } catch (error) {
    console.error('Error listing captains:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listKlyngCupCaptains();
