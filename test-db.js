const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const playerCount = await prisma.player.count();
    console.log(`Found ${playerCount} players`);
    
    // Test tournaments
    const tournamentCount = await prisma.tournament.count();
    console.log(`Found ${tournamentCount} tournaments`);
    
    // Test clubs
    const clubCount = await prisma.club.count();
    console.log(`Found ${clubCount} clubs`);
    
    // Test a simple tournament query
    const tournaments = await prisma.tournament.findMany({
      take: 3,
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });
    
    console.log('Sample tournaments:', tournaments);
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();

