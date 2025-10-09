import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Finding Round 6 Players ===\n');

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

  // Look for players with names that match your description
  const targetNames = ['Ryan', 'Harry', 'Deepak', 'Yida', 'Mel', 'Christie', 'Jess', 'Sue', 'Anand'];
  
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
        const match = round6.matches.find(m => m.teamAId === stp.teamId || m.teamBId === stp.teamId);
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
    const match = round6.matches.find(m => m.id === matchId);
    console.log(`\nMatch: ${match?.teamA?.name} vs ${match?.teamB?.name}`);
    console.log(`Match ID: ${matchId}`);
    players.forEach(player => {
      console.log(`  ${player.name} (${player.gender})`);
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
