import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Fixing Round 6 Lineup ===\n');
  console.log('Looking for match with Ben Cates, Peter Hull, Jacob F, Lucas W\n');

  // Get all Round 6 matches in Stop 2
  const round6 = await prisma.round.findFirst({
    where: {
      stop: { name: 'Stop 2' },
      idx: 5 // Round 6 (0-based index)
    },
    include: {
      stop: { select: { id: true } },
      matches: {
        include: {
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } }
        }
      }
    }
  });

  if (!round6) {
    console.log('❌ Round 6 not found');
    return;
  }

  // Get all players from all Round 6 matches
  const allTeamIds = round6.matches.flatMap(m => [m.teamAId, m.teamBId]).filter((id): id is string => id !== null);
  
  const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: round6.stop.id,
      teamId: { in: allTeamIds }
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
  const ben = stopTeamPlayers.find(stp => 
    stp.player.name === 'Ben Cates' || 
    (stp.player.firstName === 'Ben' && stp.player.lastName === 'Cates')
  );
  const peter = stopTeamPlayers.find(stp => 
    stp.player.name === 'Peter Hull' || 
    (stp.player.firstName === 'Peter' && stp.player.lastName === 'Hull')
  );
  const eden = stopTeamPlayers.find(stp => 
    stp.player.name === 'Eden Jiang' || 
    (stp.player.firstName === 'Eden' && stp.player.lastName === 'Jiang')
  );
  const jacob = stopTeamPlayers.find(stp => 
    stp.player.name === 'Jacob F' || 
    (stp.player.firstName === 'Jacob' && stp.player.lastName === 'F')
  );
  const lucas = stopTeamPlayers.find(stp => 
    stp.player.name === 'Lucas W' || 
    (stp.player.firstName === 'Lucas' && stp.player.lastName === 'W')
  );

  console.log('Found players:');
  console.log(`Ben: ${ben?.player.name} (${ben?.player.gender}) - Match: ${ben ? round6.matches.find(m => m.teamAId === ben.teamId || m.teamBId === ben.teamId)?.id : 'N/A'}`);
  console.log(`Peter: ${peter?.player.name} (${peter?.player.gender}) - Match: ${peter ? round6.matches.find(m => m.teamAId === peter.teamId || m.teamBId === peter.teamId)?.id : 'N/A'}`);
  console.log(`Eden: ${eden?.player.name} (${eden?.player.gender}) - Match: ${eden ? round6.matches.find(m => m.teamAId === eden.teamId || m.teamBId === eden.teamId)?.id : 'N/A'}`);
  console.log(`Jacob: ${jacob?.player.name} (${jacob?.player.gender}) - Match: ${jacob ? round6.matches.find(m => m.teamAId === jacob.teamId || m.teamBId === jacob.teamId)?.id : 'N/A'}`);
  console.log(`Lucas: ${lucas?.player.name} (${lucas?.player.gender}) - Match: ${lucas ? round6.matches.find(m => m.teamAId === lucas.teamId || m.teamBId === lucas.teamId)?.id : 'N/A'}`);

  // Find the match that has both Ben and Peter (and Jacob and Lucas)
  const matchWithBenPeter = round6.matches.find(match => {
    const hasBen = stopTeamPlayers.some(stp => 
      stp.teamId === match.teamAId || stp.teamId === match.teamBId
    ) && stopTeamPlayers.some(stp => 
      (stp.teamId === match.teamAId || stp.teamId === match.teamBId) && 
      (stp.player.name === 'Ben Cates' || (stp.player.firstName === 'Ben' && stp.player.lastName === 'Cates'))
    );
    const hasPeter = stopTeamPlayers.some(stp => 
      (stp.teamId === match.teamAId || stp.teamId === match.teamBId) && 
      (stp.player.name === 'Peter Hull' || (stp.player.firstName === 'Peter' && stp.player.lastName === 'Hull'))
    );
    return hasBen && hasPeter;
  });

  if (!matchWithBenPeter) {
    console.log('❌ Match with Ben and Peter not found');
    return;
  }

  console.log(`\nFound match: ${matchWithBenPeter.teamA?.name} vs ${matchWithBenPeter.teamB?.name}`);
  console.log(`Match ID: ${matchWithBenPeter.id}`);

  // Check if Eden is in this match
  const edenInMatch = stopTeamPlayers.some(stp => 
    (stp.teamId === matchWithBenPeter.teamAId || stp.teamId === matchWithBenPeter.teamBId) && 
    (stp.player.name === 'Eden Jiang' || (stp.player.firstName === 'Eden' && stp.player.lastName === 'Jiang'))
  );

  if (!edenInMatch) {
    console.log('❌ Eden is not in this match. Let me check all Round 6 matches for Eden...');
    
    // Check all matches for Eden
    round6.matches.forEach(match => {
      const edenInThisMatch = stopTeamPlayers.some(stp => 
        (stp.teamId === match.teamAId || stp.teamId === match.teamBId) && 
        (stp.player.name === 'Eden Jiang' || (stp.player.firstName === 'Eden' && stp.player.lastName === 'Jiang'))
      );
      if (edenInThisMatch) {
        console.log(`Eden is in: ${match.teamA?.name} vs ${match.teamB?.name} (${match.id})`);
      }
    });
    return;
  }

  // Get the MENS_DOUBLES game for this match
  const game = await prisma.game.findFirst({
    where: {
      matchId: matchWithBenPeter.id,
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

  console.log(`\nCurrent MENS_DOUBLES lineup:`);
  console.log(`Team A (${matchWithBenPeter.teamA?.name}): ${JSON.stringify(game.teamALineup)}`);
  console.log(`Team B (${matchWithBenPeter.teamB?.name}): ${JSON.stringify(game.teamBLineup)}`);

  // Determine which team Peter and Eden are on
  const peterTeamId = peter?.teamId;
  const edenTeamId = eden?.teamId;
  const jacobTeamId = jacob?.teamId;
  const lucasTeamId = lucas?.teamId;

  if (!peterTeamId || !edenTeamId || !jacobTeamId || !lucasTeamId) {
    console.log('❌ Missing team information for players');
    return;
  }

  // Set the correct lineup: Peter + Eden vs Jacob + Lucas
  const teamALineup = peterTeamId === matchWithBenPeter.teamAId ? 
    [{ player1Id: peter!.player.id, player2Id: eden!.player.id }] :
    [{ player1Id: jacob!.player.id, player2Id: lucas!.player.id }];
  
  const teamBLineup = peterTeamId === matchWithBenPeter.teamAId ? 
    [{ player1Id: jacob!.player.id, player2Id: lucas!.player.id }] :
    [{ player1Id: peter!.player.id, player2Id: eden!.player.id }];

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
    console.log(`${matchWithBenPeter.teamA?.name} (Team A): ${peterTeamId === matchWithBenPeter.teamAId ? `${peter!.player.name} & ${eden!.player.name}` : `${jacob!.player.name} & ${lucas!.player.name}`}`);
    console.log(`${matchWithBenPeter.teamB?.name} (Team B): ${peterTeamId === matchWithBenPeter.teamAId ? `${jacob!.player.name} & ${lucas!.player.name}` : `${peter!.player.name} & ${eden!.player.name}`}`);
  } catch (error) {
    console.error('❌ Error updating lineup:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
