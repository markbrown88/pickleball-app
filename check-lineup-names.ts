import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Lineup Names for Real Pickleball Intermediate vs One Health Intermediate ===\n');

  const matchId = 'cmgdy7sqo006pr0k8iq2wujpm';

  // Get the match details
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      games: {
        select: {
          id: true,
          slot: true,
          teamALineup: true,
          teamBLineup: true,
          lineupConfirmed: true
        },
        orderBy: { slot: 'asc' }
      }
    }
  });

  if (!match) {
    console.log('❌ Match not found');
    return;
  }

  console.log(`Match: ${match.teamA?.name} vs ${match.teamB?.name}`);
  console.log(`Match ID: ${match.id}\n`);

  // Check games and their lineups
  console.log('=== Games and Lineups ===');
  match.games.forEach((game, index) => {
    console.log(`${index + 1}. ${game.slot}:`);
    console.log(`   Team A Lineup: ${game.teamALineup ? JSON.stringify(game.teamALineup) : 'null'}`);
    console.log(`   Team B Lineup: ${game.teamBLineup ? JSON.stringify(game.teamBLineup) : 'null'}`);
    console.log(`   Lineup Confirmed: ${game.lineupConfirmed}`);
    console.log('');
  });

  // Check if there are any lineups in the old system
  console.log('=== Checking Old Lineup System ===');
  
  const oldLineups = await prisma.lineup.findMany({
    where: {
      roundId: match.roundId,
      teamId: { in: [match.teamAId!, match.teamBId!] }
    },
    include: {
      entries: {
        include: {
          player1: { select: { id: true, name: true, firstName: true, lastName: true } },
          player2: { select: { id: true, name: true, firstName: true, lastName: true } }
        }
      }
    }
  });

  console.log(`Old lineups found: ${oldLineups.length}`);
  oldLineups.forEach((lineup, index) => {
    const teamName = lineup.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name;
    console.log(`  ${index + 1}. ${teamName} lineup (${lineup.entries.length} entries):`);
    lineup.entries.forEach(entry => {
      const player1Name = entry.player1.name || `${entry.player1.firstName || ''} ${entry.player1.lastName || ''}`.trim();
      const player2Name = entry.player2.name || `${entry.player2.firstName || ''} ${entry.player2.lastName || ''}`.trim();
      console.log(`     ${entry.slot}: ${player1Name} & ${player2Name}`);
    });
  });

  // Check team rosters to see if we can find the expected players
  console.log('\n=== Team Rosters ===');
  
  const stopTeamPlayersA = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: match.round.stopId,
      teamId: match.teamAId!
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

  const stopTeamPlayersB = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: match.round.stopId,
      teamId: match.teamBId!
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

  console.log(`Team A (${match.teamA?.name}) roster: ${stopTeamPlayersA.length} players`);
  stopTeamPlayersA.forEach((stp, index) => {
    const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
    console.log(`  ${index + 1}. ${playerName} (${stp.player.gender}) - ID: ${stp.player.id}`);
  });

  console.log(`\nTeam B (${match.teamB?.name}) roster: ${stopTeamPlayersB.length} players`);
  stopTeamPlayersB.forEach((stp, index) => {
    const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
    console.log(`  ${index + 1}. ${playerName} (${stp.player.gender}) - ID: ${stp.player.id}`);
  });

  // Look for the expected players
  console.log('\n=== Looking for Expected Players ===');
  const expectedPlayers = ['Adrien', 'Christie', 'Drew', 'MaryAnn'];
  
  console.log('Looking for players with names containing:');
  expectedPlayers.forEach(name => {
    const foundA = stopTeamPlayersA.find(stp => {
      const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
      return playerName.toLowerCase().includes(name.toLowerCase());
    });
    
    const foundB = stopTeamPlayersB.find(stp => {
      const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
      return playerName.toLowerCase().includes(name.toLowerCase());
    });
    
    console.log(`  ${name}:`);
    if (foundA) {
      const playerName = foundA.player.name || `${foundA.player.firstName || ''} ${foundA.player.lastName || ''}`.trim();
      console.log(`    Found in Team A: ${playerName} (${foundA.player.gender})`);
    }
    if (foundB) {
      const playerName = foundB.player.name || `${foundB.player.firstName || ''} ${foundB.player.lastName || ''}`.trim();
      console.log(`    Found in Team B: ${playerName} (${foundB.player.gender})`);
    }
    if (!foundA && !foundB) {
      console.log(`    Not found in either team`);
    }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
