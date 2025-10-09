import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Setting MIXED_2 Lineup for Real Pickleball Intermediate vs One Health Intermediate ===\n');

  const matchId = 'cmgdy7sqo006pr0k8iq2wujpm';

  // Get the MIXED_2 game
  const mixed2Game = await prisma.game.findFirst({
    where: {
      matchId: matchId,
      slot: 'MIXED_2'
    }
  });

  if (!mixed2Game) {
    console.log('❌ MIXED_2 game not found');
    return;
  }

  console.log(`Found MIXED_2 game: ${mixed2Game.id}`);

  // Get the match with round and stop info
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      round: {
        select: { stopId: true }
      }
    }
  });

  if (!match) {
    console.log('❌ Match not found');
    return;
  }

  console.log(`Match: ${match.teamA?.name} vs ${match.teamB?.name}`);
  console.log(`Stop ID: ${match.round.stopId}`);

  // Get players from both teams
  const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: match.round.stopId,
      teamId: { in: [match.teamAId!, match.teamBId!] }
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

  // Create player map
  const playerMap = new Map();
  stopTeamPlayers.forEach(stp => {
    const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
    playerMap.set(stp.player.id, {
      name: playerName,
      gender: stp.player.gender,
      teamId: stp.teamId
    });
  });

  // Find the players for MIXED_2
  // Based on the pattern: Adrien Mizal & Christie Han vs Drew Carrick & Maryann Kewin
  
  const teamAMale = stopTeamPlayers.find(stp => 
    stp.teamId === match.teamAId && 
    (stp.player.name?.includes('Adrien') || stp.player.firstName?.includes('Adrien'))
  );
  
  const teamAFemale = stopTeamPlayers.find(stp => 
    stp.teamId === match.teamAId && 
    (stp.player.name?.includes('Christie') || stp.player.firstName?.includes('Christie'))
  );
  
  const teamBMale = stopTeamPlayers.find(stp => 
    stp.teamId === match.teamBId && 
    (stp.player.name?.includes('Drew') || stp.player.firstName?.includes('Drew'))
  );
  
  const teamBFemale = stopTeamPlayers.find(stp => 
    stp.teamId === match.teamBId && 
    (stp.player.name?.includes('Maryann') || stp.player.firstName?.includes('Maryann'))
  );

  if (!teamAMale || !teamAFemale || !teamBMale || !teamBFemale) {
    console.log('❌ Could not find the expected players');
    console.log('Available players:');
    stopTeamPlayers.forEach(stp => {
      const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
      const teamName = stp.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name;
      console.log(`  ${playerName} (${stp.player.gender}) - ${teamName}`);
    });
    return;
  }

  console.log('\nSelected players for MIXED_2:');
  const teamAMaleName = teamAMale.player.name || `${teamAMale.player.firstName || ''} ${teamAMale.player.lastName || ''}`.trim();
  const teamAFemaleName = teamAFemale.player.name || `${teamAFemale.player.firstName || ''} ${teamAFemale.player.lastName || ''}`.trim();
  const teamBMaleName = teamBMale.player.name || `${teamBMale.player.firstName || ''} ${teamBMale.player.lastName || ''}`.trim();
  const teamBFemaleName = teamBFemale.player.name || `${teamBFemale.player.firstName || ''} ${teamBFemale.player.lastName || ''}`.trim();
  
  console.log(`  Team A: ${teamAMaleName} & ${teamAFemaleName}`);
  console.log(`  Team B: ${teamBMaleName} & ${teamBFemaleName}`);

  // Update the MIXED_2 game with the lineups
  const teamALineup = [{ player1Id: teamAMale.player.id, player2Id: teamAFemale.player.id }];
  const teamBLineup = [{ player1Id: teamBMale.player.id, player2Id: teamBFemale.player.id }];

  try {
    await prisma.game.update({
      where: { id: mixed2Game.id },
      data: {
        teamALineup: teamALineup,
        teamBLineup: teamBLineup,
        lineupConfirmed: true
      }
    });

    console.log('\n✅ Successfully set MIXED_2 lineup!');
    console.log(`Team A: ${teamAMaleName} & ${teamAFemaleName}`);
    console.log(`Team B: ${teamBMaleName} & ${teamBFemaleName}`);
    console.log('Lineup confirmed: true');

  } catch (error) {
    console.error('❌ Error setting lineup:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
