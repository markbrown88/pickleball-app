const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateOneHealth() {
  try {
    const clubId = 'cmfosxo930004rdbay7ha4qm1'; // One Health club ID
    
    const updatedClub = await prisma.club.update({
      where: { id: clubId },
      data: {
        address: '2021 Cliff Road, Mississauga, ON, Canada, L5A 3N7',
        email: 'concierge@onehealthclubs.com',
        description: 'Premier fitness club offering pickleball programs for all skill levels. Features 7 dedicated indoor pickleball courts with expert-led lessons, clinics, member events, and competitive play. Includes private coaching, group lessons, and level-based play sessions with experienced coaches.',
        logo: 'https://onehealthclubs.com/images/logo.png' // Will need to find actual logo URL
      }
    });
    
    console.log('Successfully updated One Health club:');
    console.log(JSON.stringify(updatedClub, null, 2));
    
  } catch (error) {
    console.error('Error updating club:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateOneHealth();



