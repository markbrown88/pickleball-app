import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Setting MIXED_2 Lineup with Correct Player IDs ===\n');

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

  // Set the lineup with the correct player IDs
  // Team A (One Health): Adrien Mizal & Christie Han
  // Team B (Real Pickleball): Drew Carrick & Maryann Kewin
  
  const teamALineup = [
    { 
      player1Id: 'cmg079vxy0015rddcu42qbt3g', // Adrien Mizal
      player2Id: 'cmfpbp773000rrdn0gu503m4k'  // Christie Han
    }
  ];
  
  const teamBLineup = [
    { 
      player1Id: 'cmfpbp7ez0013rdn0lurlnqbe', // Drew Carrick
      player2Id: 'cmfpbp8gv002trdn0dvle7xtr'  // Maryann Kewin
    }
  ];

  try {
    await prisma.game.update({
      where: { id: mixed2Game.id },
      data: {
        teamALineup: teamALineup,
        teamBLineup: teamBLineup,
        lineupConfirmed: true
      }
    });

    console.log('✅ Successfully set MIXED_2 lineup!');
    console.log('Team A (One Health): Adrien Mizal & Christie Han');
    console.log('Team B (Real Pickleball): Drew Carrick & Maryann Kewin');
    console.log('Lineup confirmed: true');

  } catch (error) {
    console.error('❌ Error setting lineup:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
