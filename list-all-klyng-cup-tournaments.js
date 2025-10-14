const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listAllKlyngCupTournaments() {
  try {
    console.log('Finding all tournaments with "Klyng Cup" in the name...\n');

    // Find all tournaments with "Klyng Cup" in the name
    const tournaments = await prisma.tournament.findMany({
      where: {
        name: {
          contains: 'Klyng Cup',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            teams: true,
            stops: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${tournaments.length} tournament(s) with "Klyng Cup" in the name:\n`);

    for (let i = 0; i < tournaments.length; i++) {
      const tournament = tournaments[i];
      console.log(`${i + 1}. ${tournament.name}`);
      console.log(`   ID: ${tournament.id}`);
      console.log(`   Created: ${tournament.createdAt.toISOString()}`);
      console.log(`   Teams: ${tournament._count.teams}`);
      console.log(`   Stops: ${tournament._count.stops}`);
      console.log('');
    }

    // For each tournament, check for Wildcard teams
    for (const tournament of tournaments) {
      console.log(`\n🔍 Checking for Wildcard teams in "${tournament.name}":\n`);
      
      const wildcardTeams = await prisma.team.findMany({
        where: {
          tournamentId: tournament.id,
          name: {
            contains: 'wildcard',
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          name: true,
          clubId: true,
          captainId: true,
          club: {
            select: {
              name: true
            }
          },
          captain: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true
            }
          }
        }
      });

      if (wildcardTeams.length > 0) {
        console.log(`Found ${wildcardTeams.length} Wildcard team(s):`);
        wildcardTeams.forEach((team, index) => {
          const captain = team.captain;
          const captainName = captain ? `${captain.firstName} ${captain.lastName}`.trim() || captain.name : 'No captain';
          console.log(`  ${index + 1}. "${team.name}" - Captain: ${captainName}`);
        });
      } else {
        console.log('No Wildcard teams found in this tournament.');
      }
    }

  } catch (error) {
    console.error('Error listing tournaments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAllKlyngCupTournaments();
