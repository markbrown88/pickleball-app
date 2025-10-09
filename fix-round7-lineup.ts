import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Fixing Round 7 Lineup ===\n');
  console.log('Rally/OPA Advanced vs One Health Advanced\n');

  const matchId = 'cmgdy81fi00e9r0k83390lk5i';

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
  const peter = stopTeamPlayers.find(stp => 
    stp.player.name === 'Peter Hull' || 
    (stp.player.firstName === 'Peter' && stp.player.lastName === 'Hull')
  );
  const eden = stopTeamPlayers.find(stp => 
    stp.player.name === 'Eden Jiang' || 
    (stp.player.firstName === 'Eden' && stp.player.lastName === 'Jiang')
  );
  const ben = stopTeamPlayers.find(stp => 
    stp.player.name === 'Ben Cates' || 
    (stp.player.firstName === 'Ben' && stp.player.lastName === 'Cates')
  );

  console.log('Found players:');
  console.log(`Peter: ${peter?.player.name} (${peter?.player.gender}) - ${peter?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Eden: ${eden?.player.name} (${eden?.player.gender}) - ${eden?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);
  console.log(`Ben: ${ben?.player.name} (${ben?.player.gender}) - ${ben?.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name}`);

  // Get all players from Rally/OPA team (Team A) to find Jacob and Lucas
  const rallyOPAPlayers = stopTeamPlayers.filter(stp => stp.teamId === match.teamAId);
  console.log('\nRally/OPA Advanced players:');
  rallyOPAPlayers.forEach(player => {
    console.log(`  ${player.player.name} (${player.player.gender})`);
  });

  // Find Jacob and Lucas on Rally/OPA team
  const jacob = rallyOPAPlayers.find(stp => 
    stp.player.firstName === 'Jacob' || stp.player.name?.includes('Jacob')
  );
  const lucas = rallyOPAPlayers.find(stp => 
    stp.player.firstName === 'Lucas' || stp.player.name?.includes('Lucas')
  );

  console.log(`\nJacob: ${jacob?.player.name} (${jacob?.player.gender})`);
  console.log(`Lucas: ${lucas?.player.name} (${lucas?.player.gender})`);

  if (!peter || !eden || !jacob || !lucas) {
    console.log('❌ Missing some players');
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
  console.log(`Team A (Rally/OPA): ${JSON.stringify(game.teamALineup)}`);
  console.log(`Team B (One Health): ${JSON.stringify(game.teamBLineup)}`);

  // Set the correct lineup: Peter + Eden vs Jacob + Lucas
  // Peter and Eden are on One Health (Team B)
  // Jacob and Lucas are on Rally/OPA (Team A)
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
    console.log(`Rally/OPA (Team A): ${jacob.player.name} & ${lucas.player.name}`);
    console.log(`One Health (Team B): ${peter.player.name} & ${eden.player.name}`);
  } catch (error) {
    console.error('❌ Error updating lineup:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
