import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Searching for Thea in Greenhills Advanced ===\n');

  const matchId = 'cmgdy7w6j009pr0k88zi7qn8v';

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

  console.log('All players with detailed names:');
  stopTeamPlayers.forEach(stp => {
    const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
    const teamName = stp.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name;
    console.log(`  ID: ${stp.player.id}`);
    console.log(`  Name: "${stp.player.name}"`);
    console.log(`  First: "${stp.player.firstName}"`);
    console.log(`  Last: "${stp.player.lastName}"`);
    console.log(`  Gender: ${stp.player.gender}`);
    console.log(`  Team: ${teamName}`);
    console.log('  ---');
  });

  // Look specifically for "Thea" in different ways
  console.log('\n=== Searching for Thea ===');
  
  const theaVariations = ['Thea', 'thea', 'THEA', 'Thea ', ' Thea'];
  
  stopTeamPlayers.forEach(stp => {
    const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
    const firstName = stp.player.firstName || '';
    const lastName = stp.player.lastName || '';
    
    theaVariations.forEach(variation => {
      if (playerName.includes(variation) || firstName.includes(variation) || lastName.includes(variation)) {
        const teamName = stp.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name;
        console.log(`Found "${variation}" in: ${playerName} (${stp.player.gender}) - ${teamName}`);
      }
    });
  });

  // Also check if there might be a "Thea" in the full name that I missed
  console.log('\n=== Checking for partial matches ===');
  stopTeamPlayers.forEach(stp => {
    const playerName = stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim();
    if (playerName.toLowerCase().includes('the')) {
      const teamName = stp.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name;
      console.log(`Contains "the": ${playerName} (${stp.player.gender}) - ${teamName}`);
    }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
