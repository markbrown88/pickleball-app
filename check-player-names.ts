import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Player Names for Lineups ===\n');

  const matchId = 'cmgdy7sqo006pr0k8iq2wujpm';

  // Get the match details
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      round: {
        select: { stopId: true }
      },
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

  // Create a map of player ID to player name
  const playerMap = new Map();
  stopTeamPlayers.forEach(stp => {
    const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
    playerMap.set(stp.player.id, {
      name: playerName,
      gender: stp.player.gender,
      teamId: stp.teamId
    });
  });

  console.log('=== Player Map ===');
  playerMap.forEach((player, playerId) => {
    const teamName = player.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name;
    console.log(`${playerId}: ${player.name} (${player.gender}) - ${teamName}`);
  });

  // Check games and resolve player names
  console.log('\n=== Games and Resolved Lineups ===');
  match.games.forEach((game, index) => {
    console.log(`${index + 1}. ${game.slot}:`);
    
    if (game.teamALineup && Array.isArray(game.teamALineup)) {
      console.log(`   Team A Lineup:`);
      game.teamALineup.forEach((lineup: any, lineupIndex: number) => {
        if (lineup.player1Id && lineup.player2Id) {
          const player1 = playerMap.get(lineup.player1Id);
          const player2 = playerMap.get(lineup.player2Id);
          console.log(`     ${lineupIndex + 1}. ${player1?.name || 'Unknown'} & ${player2?.name || 'Unknown'}`);
        }
      });
    } else {
      console.log(`   Team A Lineup: null`);
    }
    
    if (game.teamBLineup && Array.isArray(game.teamBLineup)) {
      console.log(`   Team B Lineup:`);
      game.teamBLineup.forEach((lineup: any, lineupIndex: number) => {
        if (lineup.player1Id && lineup.player2Id) {
          const player1 = playerMap.get(lineup.player1Id);
          const player2 = playerMap.get(lineup.player2Id);
          console.log(`     ${lineupIndex + 1}. ${player1?.name || 'Unknown'} & ${player2?.name || 'Unknown'}`);
        }
      });
    } else {
      console.log(`   Team B Lineup: null`);
    }
    
    console.log(`   Lineup Confirmed: ${game.lineupConfirmed}`);
    console.log('');
  });

  // Look for the expected players
  console.log('=== Looking for Expected Players ===');
  const expectedPlayers = ['Adrien', 'Christie', 'Drew', 'MaryAnn'];
  
  console.log('Looking for players with names containing:');
  expectedPlayers.forEach(name => {
    const found = Array.from(playerMap.values()).find(player => 
      player.name.toLowerCase().includes(name.toLowerCase())
    );
    
    if (found) {
      const teamName = found.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name;
      console.log(`  ${name}: Found - ${found.name} (${found.gender}) in ${teamName}`);
    } else {
      console.log(`  ${name}: Not found`);
    }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
