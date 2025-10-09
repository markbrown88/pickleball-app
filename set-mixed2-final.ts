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

  // Find the specific players by their exact names
  const teamAMale = stopTeamPlayers.find(stp => 
    stp.teamId === match.teamAId && 
    stp.player.name === 'Adrien Mizal'
  );
  
  const teamAFemale = stopTeamPlayers.find(stp => 
    stp.teamId === match.teamAId && 
    stp.player.name === 'Christie Han'
  );
  
  const teamBMale = stopTeamPlayers.find(stp => 
    stp.teamId === match.teamBId && 
    stp.player.name === 'Drew Carrick'
  );
  
  const teamBFemale = stopTeamPlayers.find(stp => 
    stp.teamId === match.teamBId && 
    stp.player.name === 'Maryann Kewin'
  );

  if (!teamAMale || !teamAFemale || !teamBMale || !teamBFemale) {
    console.log('❌ Could not find the expected players');
    return;
  }

  console.log('\nSelected players for MIXED_2:');
  console.log(`  Team A: ${teamAMale.player.name} & ${teamAFemale.player.name}`);
  console.log(`  Team B: ${teamBMale.player.name} & ${teamBFemale.player.name}`);

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
    console.log(`Team A: ${teamAMale.player.name} & ${teamAFemale.player.name}`);
    console.log(`Team B: ${teamBMale.player.name} & ${teamBFemale.player.name}`);
    console.log('Lineup confirmed: true');

  } catch (error) {
    console.error('❌ Error setting lineup:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
