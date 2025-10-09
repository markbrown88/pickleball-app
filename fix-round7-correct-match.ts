import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Fixing Round 7 Lineup - Correct Match ===\n');
  console.log('4 Fathers Advanced vs Wildcard Advanced\n');

  const matchId = 'cmgdy81qh00ejr0k8x81ehl4t';

  // Get the match details
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

  // Get all players from both teams
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

  // Find the specific players
  const jacob = stopTeamPlayers.find(stp => 
    stp.player.name === 'Jacob F' || 
    (stp.player.firstName === 'Jacob' && stp.player.lastName === 'F')
  );
  const lucas = stopTeamPlayers.find(stp => 
    stp.player.name === 'Lucas W' || 
    (stp.player.firstName === 'Lucas' && stp.player.lastName === 'W')
  );

  console.log('Found players:');
  console.log(`Jacob: ${jacob?.player.name} (${jacob?.player.gender}) - ${jacob?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Lucas: ${lucas?.player.name} (${lucas?.player.gender}) - ${lucas?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);

  // Get all players from both teams to find Peter and Eden
  console.log('\nAll players in this match:');
  stopTeamPlayers.forEach(stp => {
    const teamName = stp.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name;
    console.log(`  ${stp.player.name} (${stp.player.gender}) - ${teamName}`);
  });

  // Look for Peter and Eden
  const peter = stopTeamPlayers.find(stp => 
    stp.player.firstName === 'Peter' || stp.player.name?.includes('Peter')
  );
  const eden = stopTeamPlayers.find(stp => 
    stp.player.firstName === 'Eden' || stp.player.name?.includes('Eden')
  );

  console.log(`\nPeter: ${peter?.player.name} (${peter?.player.gender})`);
  console.log(`Eden: ${eden?.player.name} (${eden?.player.gender})`);

  if (!jacob || !lucas) {
    console.log('❌ Missing Jacob or Lucas');
    return;
  }

  if (!peter || !eden) {
    console.log('❌ Peter and Eden are not in this match. They might be in a different match.');
    console.log('Let me check if you meant a different pairing...');
    
    // Maybe you meant different players? Let me show the current lineup
    const game = await prisma.game.findFirst({
      where: {
        matchId: matchId,
        slot: 'MENS_DOUBLES'
      },
      select: {
        id: true,
        slot: true,
        teamALineup: true,
        teamBLineup: true
      }
    });

    if (game) {
      console.log(`\nCurrent MENS_DOUBLES lineup:`);
      console.log(`Team A (${match.teamA?.name}): ${JSON.stringify(game.teamALineup)}`);
      console.log(`Team B (${match.teamB?.name}): ${JSON.stringify(game.teamBLineup)}`);
    }
    return;
  }

  // Get the MENS_DOUBLES game
  const game = await prisma.game.findFirst({
    where: {
      matchId: matchId,
      slot: 'MENS_DOUBLES'
    },
    select: {
      id: true,
      slot: true,
      teamALineup: true,
      teamBLineup: true
    }
  });

  if (!game) {
    console.log('❌ MENS_DOUBLES game not found');
    return;
  }

  console.log(`\nCurrent lineup:`);
  console.log(`Team A (${match.teamA?.name}): ${JSON.stringify(game.teamALineup)}`);
  console.log(`Team B (${match.teamB?.name}): ${JSON.stringify(game.teamBLineup)}`);

  // Set the correct lineup: Peter + Eden vs Jacob + Lucas
  const teamALineup = [{ player1Id: jacob.player.id, player2Id: lucas.player.id }];
  const teamBLineup = [{ player1Id: peter.player.id, player2Id: eden.player.id }];

  try {
    await prisma.game.update({
      where: { id: game.id },
      data: {
        teamALineup: teamALineup,
        teamBLineup: teamBLineup,
        lineupConfirmed: true
      }
    });

    console.log('\n✅ MENS_DOUBLES lineup updated successfully!');
    console.log(`${match.teamA?.name} (Team A): ${jacob.player.name} & ${lucas.player.name}`);
    console.log(`${match.teamB?.name} (Team B): ${peter.player.name} & ${eden.player.name}`);
  } catch (error) {
    console.error('❌ Error updating lineup:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
