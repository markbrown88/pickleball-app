import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Stop 1 Team Rosters ===\n');

  // Get Stop 1
  const stop1 = await prisma.stop.findFirst({
    where: { name: 'Stop 1' },
    select: { id: true, name: true }
  });

  if (!stop1) {
    console.log('❌ Stop 1 not found');
    return;
  }

  // Get all teams that played in Stop 1
  const teams = await prisma.team.findMany({
    where: {
      OR: [
        {
          matchesA: {
            some: {
              round: { stopId: stop1.id }
            }
          }
        },
        {
          matchesB: {
            some: {
              round: { stopId: stop1.id }
            }
          }
        }
      ]
    },
    select: {
      id: true,
      name: true,
      club: {
        select: { name: true }
      }
    }
  });

  console.log(`Found ${teams.length} teams in Stop 1`);

  // Check if teams have rosters for Stop 1
  for (const team of teams.slice(0, 3)) { // Check first 3 teams
    console.log(`\n=== ${team.name} (${team.club?.name}) ===`);
    
    const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
      where: {
        stopId: stop1.id,
        teamId: team.id
      },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            gender: true
          }
        }
      }
    });

    console.log(`  Roster size: ${stopTeamPlayers.length}`);
    
    if (stopTeamPlayers.length > 0) {
      console.log(`  Players:`);
      stopTeamPlayers.forEach(stp => {
        const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
        console.log(`    ${playerName} (${stp.player.gender})`);
      });
    } else {
      console.log(`  ❌ No roster found for this team`);
    }
  }

  // Check if we can create lineups from rosters
  console.log(`\n=== Can we create lineups? ===`);
  
  const teamsWithRosters = await Promise.all(
    teams.map(async (team) => {
      const roster = await prisma.stopTeamPlayer.findMany({
        where: {
          stopId: stop1.id,
          teamId: team.id
        },
        include: {
          player: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              gender: true
            }
          }
        }
      });
      
      return {
        team,
        roster,
        hasEnoughPlayers: roster.length >= 4,
        hasMalePlayers: roster.filter(p => p.player.gender === 'MALE').length >= 2,
        hasFemalePlayers: roster.filter(p => p.player.gender === 'FEMALE').length >= 2
      };
    })
  );

  const teamsReadyForLineups = teamsWithRosters.filter(t => 
    t.hasEnoughPlayers && t.hasMalePlayers && t.hasFemalePlayers
  );

  console.log(`Teams with complete rosters: ${teamsReadyForLineups.length}/${teams.length}`);
  
  if (teamsReadyForLineups.length > 0) {
    console.log(`\n✅ We can create lineups for Stop 1!`);
    console.log(`✅ This will fix the missing players/scores display issue`);
    console.log(`\nTeams ready for lineups:`);
    teamsReadyForLineups.forEach(t => {
      console.log(`  ${t.team.name}: ${t.roster.length} players (${t.roster.filter(p => p.player.gender === 'MALE').length}M, ${t.roster.filter(p => p.player.gender === 'FEMALE').length}F)`);
    });
  } else {
    console.log(`\n❌ Cannot create lineups - teams don't have complete rosters`);
    console.log(`❌ This explains why no players/scores are visible`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
