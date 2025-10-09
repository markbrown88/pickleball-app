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

  // Get the match to determine team assignments
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      round: { select: { stopId: true } }
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

  // Find the players for MIXED_2 based on the pattern from other games
  // Looking at MIXED_1: Harry Oh & Amna Jamal vs Spencer Carrick & Chery Macdonald
  // For MIXED_2, we need the other male/female combination
  
  // Team A (One Health): Need a different male/female pair
  // Team B (Real Pickleball): Need a different male/female pair
  
  // From the roster, let's find the right players
  const teamAPlayers = Array.from(playerMap.values()).filter(p => p.teamId === match.teamAId);
  const teamBPlayers = Array.from(playerMap.values()).filter(p => p.teamId === match.teamBId);
  
  console.log('\nTeam A (One Health) players:');
  teamAPlayers.forEach(p => console.log(`  ${p.name} (${p.gender})`));
  
  console.log('\nTeam B (Real Pickleball) players:');
  teamBPlayers.forEach(p => console.log(`  ${p.name} (${p.gender})`));

  // For MIXED_2, we need different players than MIXED_1
  // MIXED_1 was: Harry Oh & Amna Jamal vs Spencer Carrick & Chery Macdonald
  // MIXED_2 should be: Adrien Mizal & Christie Han vs Drew Carrick & Maryann Kewin
  
  const teamAMale = teamAPlayers.find(p => p.name.includes('Adrien'));
  const teamAFemale = teamAPlayers.find(p => p.name.includes('Christie'));
  const teamBMale = teamBPlayers.find(p => p.name.includes('Drew'));
  const teamBFemale = teamBPlayers.find(p => p.name.includes('Maryann'));

  if (!teamAMale || !teamAFemale || !teamBMale || !teamBFemale) {
    console.log('❌ Could not find the expected players');
    return;
  }

  console.log('\nSelected players for MIXED_2:');
  console.log(`  Team A: ${teamAMale.name} & ${teamAFemale.name}`);
  console.log(`  Team B: ${teamBMale.name} & ${teamBFemale.name}`);

  // Find player IDs
  const teamAMaleId = Array.from(playerMap.keys()).find(id => playerMap.get(id).name === teamAMale.name);
  const teamAFemaleId = Array.from(playerMap.keys()).find(id => playerMap.get(id).name === teamAFemale.name);
  const teamBMaleId = Array.from(playerMap.keys()).find(id => playerMap.get(id).name === teamBMale.name);
  const teamBFemaleId = Array.from(playerMap.keys()).find(id => playerMap.get(id).name === teamBFemale.name);

  if (!teamAMaleId || !teamAFemaleId || !teamBMaleId || !teamBFemaleId) {
    console.log('❌ Could not find player IDs');
    return;
  }

  // Update the MIXED_2 game with the lineups
  const teamALineup = [{ player1Id: teamAMaleId, player2Id: teamAFemaleId }];
  const teamBLineup = [{ player1Id: teamBMaleId, player2Id: teamBFemaleId }];

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
    console.log(`Team A: ${teamAMale.name} & ${teamAFemale.name}`);
    console.log(`Team B: ${teamBMale.name} & ${teamBFemale.name}`);
    console.log('Lineup confirmed: true');

  } catch (error) {
    console.error('❌ Error setting lineup:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
