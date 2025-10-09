import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Finding Round 7 Match ===\n');

  // Get all Round 7 matches in Stop 2
  const round7 = await prisma.round.findFirst({
    where: {
      stop: { name: 'Stop 2' },
      idx: 6 // Round 7 (0-based index)
    },
    include: {
      stop: { select: { id: true } },
      matches: {
        include: {
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } },
          games: {
            where: { slot: 'MENS_DOUBLES' },
            select: {
              id: true,
              slot: true,
              teamALineup: true,
              teamBLineup: true
            }
          }
        }
      }
    }
  });

  if (!round7) {
    console.log('❌ Round 7 not found');
    return;
  }

  console.log(`Round 7 has ${round7.matches.length} matches:\n`);

  // Get all players from all Round 7 matches
  const allTeamIds = round7.matches.flatMap(m => [m.teamAId, m.teamBId]).filter((id): id is string => id !== null);
  
  const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
    where: {
      stopId: round7.stop.id,
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

  // Look for players with names that match your description
  const targetNames = ['Ben', 'Peter', 'Jacob', 'Lucas', 'Eden'];
  
  console.log('Players matching target names:');
  const foundPlayers: any[] = [];
  
  stopTeamPlayers.forEach(stp => {
    const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
    const firstName = stp.player.firstName || '';
    const lastName = stp.player.lastName || '';
    
    targetNames.forEach(targetName => {
      if (playerName.toLowerCase().includes(targetName.toLowerCase()) || 
          firstName.toLowerCase().includes(targetName.toLowerCase()) ||
          lastName.toLowerCase().includes(targetName.toLowerCase())) {
        const match = round7.matches.find(m => m.teamAId === stp.teamId || m.teamBId === stp.teamId);
        const teamName = match?.teamAId === stp.teamId ? match.teamA?.name : match?.teamB?.name;
        
        foundPlayers.push({
          id: stp.player.id,
          name: playerName,
          firstName,
          lastName,
          gender: stp.player.gender,
          teamName,
          matchId: match?.id
        });
        
        console.log(`  ${targetName}: ${playerName} (${stp.player.gender}) - ${teamName} - Match: ${match?.id}`);
      }
    });
  });

  // Group by match to see which match has the most target players
  console.log('\n=== Matches with target players ===');
  const matchGroups: Record<string, any[]> = {};
  foundPlayers.forEach(player => {
    if (player.matchId) {
      if (!matchGroups[player.matchId]) {
        matchGroups[player.matchId] = [];
      }
      matchGroups[player.matchId].push(player);
    }
  });

  Object.entries(matchGroups).forEach(([matchId, players]) => {
    const match = round7.matches.find(m => m.id === matchId);
    console.log(`\nMatch: ${match?.teamA?.name} vs ${match?.teamB?.name}`);
    console.log(`Match ID: ${matchId}`);
    players.forEach(player => {
      console.log(`  ${player.name} (${player.gender})`);
    });
  });

  // Check current MENS_DOUBLES lineups
  console.log('\n=== Current MENS_DOUBLES Lineups ===');
  for (const match of round7.matches) {
    const mensDoubles = match.games.find(g => g.slot === 'MENS_DOUBLES');
    if (mensDoubles) {
      console.log(`\n${match.teamA?.name} vs ${match.teamB?.name}:`);
      if (mensDoubles.teamALineup && Array.isArray(mensDoubles.teamALineup) && mensDoubles.teamALineup.length > 0) {
        const teamA = mensDoubles.teamALineup[0];
        console.log(`  Team A: ${teamA.player1Id} + ${teamA.player2Id}`);
      }
      if (mensDoubles.teamBLineup && Array.isArray(mensDoubles.teamBLineup) && mensDoubles.teamBLineup.length > 0) {
        const teamB = mensDoubles.teamBLineup[0];
        console.log(`  Team B: ${teamB.player1Id} + ${teamB.player2Id}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
