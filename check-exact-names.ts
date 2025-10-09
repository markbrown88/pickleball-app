import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Exact Player Names ===\n');

  const matchId = 'cmgdy7sqo006pr0k8iq2wujpm';

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

  console.log('All players with exact names:');
  stopTeamPlayers.forEach(stp => {
    const teamName = stp.teamId === match.teamAId ? match.teamA?.name : match.teamB?.name;
    console.log(`  ID: ${stp.player.id}`);
    console.log(`  Name: "${stp.player.name}"`);
    console.log(`  First: "${stp.player.firstName}"`);
    console.log(`  Last: "${stp.player.lastName}"`);
    console.log(`  Gender: ${stp.player.gender}`);
    console.log(`  Team: ${teamName}`);
    console.log('  ---');
  });

  // Look for the specific players
  console.log('\nLooking for specific players:');
  
  const adrien = stopTeamPlayers.find(stp => 
    stp.player.name?.includes('Adrien') || 
    stp.player.firstName?.includes('Adrien')
  );
  console.log(`Adrien: ${adrien ? `Found - "${adrien.player.name}"` : 'Not found'}`);
  
  const christie = stopTeamPlayers.find(stp => 
    stp.player.name?.includes('Christie') || 
    stp.player.firstName?.includes('Christie')
  );
  console.log(`Christie: ${christie ? `Found - "${christie.player.name}"` : 'Not found'}`);
  
  const drew = stopTeamPlayers.find(stp => 
    stp.player.name?.includes('Drew') || 
    stp.player.firstName?.includes('Drew')
  );
  console.log(`Drew: ${drew ? `Found - "${drew.player.name}"` : 'Not found'}`);
  
  const maryann = stopTeamPlayers.find(stp => 
    stp.player.name?.includes('Maryann') || 
    stp.player.firstName?.includes('Maryann')
  );
  console.log(`Maryann: ${maryann ? `Found - "${maryann.player.name}"` : 'Not found'}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
