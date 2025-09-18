const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// First, let's get the club IDs so we can assign players to clubs
async function getClubIds() {
  const clubs = await prisma.club.findMany({
    select: { id: true, name: true }
  });
  
  const clubMap = {};
  clubs.forEach(club => {
    clubMap[club.name.toLowerCase()] = club.id;
  });
  
  return clubMap;
}

const players = [
  { firstName: "Josh", lastName: "Groot", gender: "MALE", dupr: 4.859, country: "Canada", phone: null },
  { firstName: "Gene", lastName: "Liang", gender: "MALE", dupr: 5.218, country: "Canada", phone: null },
  { firstName: "Kyle", lastName: "Toth", gender: "MALE", dupr: 4.019, country: "Canada", phone: null },
  { firstName: "Matt", lastName: "Chute", gender: "MALE", dupr: 0, country: "Canada", phone: null },
  { firstName: "Ron", lastName: "McIntrye", gender: "MALE", dupr: 0, country: "Canada", phone: null },
  { firstName: "Louis", lastName: "Pais", gender: "MALE", dupr: 3.642, country: "Canada", phone: null },
  { firstName: "Josh", lastName: "Molina", gender: "MALE", dupr: 4.379, country: "Canada", phone: null },
  { firstName: "Mark", lastName: "Hall", gender: "MALE", dupr: 4.002, country: "Canada", phone: null },
  { firstName: "Joan", lastName: "Hatch", gender: "FEMALE", dupr: 0, country: "Canada", phone: null },
  { firstName: "Monica", lastName: "Lin", gender: "FEMALE", dupr: 3.172, country: "Canada", phone: null },
  { firstName: "Marianne", lastName: "Vergeer", gender: "FEMALE", dupr: 3.983, country: "Canada", phone: null },
  { firstName: "Lily", lastName: "Brown", gender: "FEMALE", dupr: null, country: "Canada", phone: "(226) 973-5002", city: "London", region: "ON" },
  { firstName: "Lisa", lastName: "Goudie", gender: "FEMALE", dupr: 3.816, country: "Canada", phone: null },
  { firstName: "Nga", lastName: "Nguyen", gender: "FEMALE", dupr: 4.321, country: "Canada", phone: null },
  { firstName: "Trina", lastName: "Ngu", gender: "FEMALE", dupr: 4.682, country: "Canada", phone: null },
  { firstName: "Diana", lastName: "Hatch", gender: "FEMALE", dupr: 5.843, country: "Canada", phone: null },
  { firstName: "Heather", lastName: "Cannom", gender: "FEMALE", dupr: 4.909, country: "Canada", phone: null }
];

async function addPlayers() {
  try {
    console.log('Getting club IDs...');
    const clubIds = await getClubIds();
    
    // For now, assign all players to the first club (4 Fathers)
    const defaultClubId = clubIds['4 fathers'];
    
    if (!defaultClubId) {
      console.error('Could not find default club');
      return;
    }
    
    console.log('Adding players to database...');
    
    for (const player of players) {
      const playerData = {
        firstName: player.firstName,
        lastName: player.lastName,
        name: `${player.firstName} ${player.lastName}`,
        gender: player.gender,
        dupr: player.dupr,
        country: player.country,
        phone: player.phone,
        city: player.city || null,
        region: player.region || null,
        clubId: defaultClubId
      };
      
      const created = await prisma.player.create({
        data: playerData
      });
      console.log(`✓ Added: ${created.name} (${created.gender})`);
    }
    
    console.log(`\n✅ Successfully added ${players.length} players!`);
  } catch (error) {
    console.error('Error adding players:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addPlayers();
