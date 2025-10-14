const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function investigateWildcardClub() {
  try {
    const tournamentId = 'cmfot1xt50000rd6a1gvw8ozn';
    
    console.log('Investigating Wildcard Club and teams in Klyng Cup tournament...\n');

    // Find the tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { name: true }
    });

    console.log(`🏆 Tournament: ${tournament?.name}\n`);

    // Find all clubs in this tournament
    const clubs = await prisma.club.findMany({
      where: {
        Team: {
          some: {
            tournamentId: tournamentId
          }
        }
      },
      select: {
        id: true,
        name: true,
        city: true,
        region: true,
        _count: {
          select: {
            Team: {
              where: {
                tournamentId: tournamentId
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log(`Found ${clubs.length} clubs in tournament:\n`);

    clubs.forEach((club, index) => {
      console.log(`${index + 1}. ${club.name}`);
      console.log(`   ID: ${club.id}`);
      console.log(`   Location: ${club.city}, ${club.region}`);
      console.log(`   Teams: ${club._count.Team}`);
      console.log('');
    });

    // Look specifically for Wildcard club
    const wildcardClub = clubs.find(club => 
      club.name.toLowerCase().includes('wildcard')
    );

    if (wildcardClub) {
      console.log(`🎯 Found Wildcard Club:\n`);
      console.log(`   Name: ${wildcardClub.name}`);
      console.log(`   ID: ${wildcardClub.id}`);
      console.log(`   Location: ${wildcardClub.city}, ${wildcardClub.region}`);
      console.log(`   Teams: ${wildcardClub._count.Team}\n`);

      // Get all teams for this club in this tournament
      const wildcardTeams = await prisma.team.findMany({
        where: {
          tournamentId: tournamentId,
          clubId: wildcardClub.id
        },
        select: {
          id: true,
          name: true,
          captainId: true,
          bracketId: true,
          captain: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              email: true
            }
          },
          bracket: {
            select: {
              name: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      console.log(`Teams in Wildcard Club:\n`);
      wildcardTeams.forEach((team, index) => {
        const captain = team.captain;
        const captainName = captain ? `${captain.firstName} ${captain.lastName}`.trim() || captain.name : 'No captain';
        console.log(`  ${index + 1}. "${team.name}"`);
        console.log(`     Team ID: ${team.id}`);
        console.log(`     Bracket: ${team.bracket?.name || 'Unknown'}`);
        console.log(`     Captain: ${captainName}`);
        if (captain) {
          console.log(`     Captain ID: ${team.captainId}`);
          console.log(`     Captain Email: ${captain.email}`);
        }
        console.log('');
      });

      // Check for existing TournamentCaptain records for this club
      const tournamentCaptains = await prisma.tournamentCaptain.findMany({
        where: {
          tournamentId: tournamentId,
          clubId: wildcardClub.id
        },
        select: {
          playerId: true,
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              email: true
            }
          }
        }
      });

      console.log(`TournamentCaptain records for Wildcard Club:\n`);
      if (tournamentCaptains.length > 0) {
        tournamentCaptains.forEach((tc, index) => {
          const player = tc.player;
          const playerName = player ? `${player.firstName} ${player.lastName}`.trim() || player.name : 'Unknown';
          console.log(`  ${index + 1}. Captain: ${playerName}`);
          console.log(`     Player ID: ${tc.playerId}`);
          console.log(`     Email: ${player?.email || 'No email'}`);
          console.log('');
        });
      } else {
        console.log('  No TournamentCaptain records found for Wildcard Club.\n');
      }

    } else {
      console.log('❌ No Wildcard Club found in this tournament.\n');
      
      // Check if there are teams with "wildcard" in the name but no club
      const wildcardTeams = await prisma.team.findMany({
        where: {
          tournamentId: tournamentId,
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
          }
        }
      });

      if (wildcardTeams.length > 0) {
        console.log(`Found ${wildcardTeams.length} team(s) with "wildcard" in name:\n`);
        wildcardTeams.forEach((team, index) => {
          console.log(`  ${index + 1}. "${team.name}"`);
          console.log(`     Team ID: ${team.id}`);
          console.log(`     Club ID: ${team.clubId}`);
          console.log(`     Club Name: ${team.club?.name || 'Unknown'}`);
          console.log(`     Captain ID: ${team.captainId || 'None'}`);
          console.log('');
        });
      }
    }

  } catch (error) {
    console.error('Error investigating Wildcard Club:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateWildcardClub();
