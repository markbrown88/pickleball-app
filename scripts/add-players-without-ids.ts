import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Add new players to the database without IDs (IDs will be auto-generated)
 * 
 * Usage examples:
 * 1. From CSV: Modify the parseCSV function below
 * 2. From JSON: Pass an array of player objects
 * 3. Manual: Add players directly in the players array
 */

interface PlayerInput {
  // Required fields
  gender: 'MALE' | 'FEMALE';
  clubId: string;
  
  // Optional fields
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  age?: number | null;
  birthday?: Date | null;
  dupr?: number | null;
  duprSingles?: number | null;
  duprDoubles?: number | null;
  clubRatingSingles?: number | null;
  clubRatingDoubles?: number | null;
  displayAge?: boolean;
  displayLocation?: boolean;
  clerkUserId?: string | null;
  isAppAdmin?: boolean;
  disabled?: boolean;
  disabledAt?: Date | null;
  disabledBy?: string | null;
}

async function addPlayers(players: PlayerInput[]) {
  try {
    console.log(`Adding ${players.length} new player(s)...\n`);

    // Validate club IDs exist
    const clubIds = [...new Set(players.map(p => p.clubId).filter(Boolean))];
    const validClubs = await prisma.club.findMany({
      where: { id: { in: clubIds } },
      select: { id: true, name: true },
    });
    const validClubIds = new Set(validClubs.map(c => c.id));
    const clubIdToName = new Map(validClubs.map(c => [c.id, c.name]));

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      
      try {
        // Validate required fields
        if (!player.gender) {
          throw new Error('Gender is required');
        }
        if (!player.clubId) {
          throw new Error('Club ID is required');
        }
        if (!validClubIds.has(player.clubId)) {
          throw new Error(`Invalid club ID: ${player.clubId}`);
        }

        // Check for email conflicts if email provided
        if (player.email) {
          const existingEmail = await prisma.player.findUnique({
            where: { email: player.email },
          });
          if (existingEmail) {
            throw new Error(`Email already exists: ${player.email} (belongs to player ${existingEmail.id})`);
          }
        }

        // Check for clerkUserId conflicts if provided
        if (player.clerkUserId) {
          const existingClerkUser = await prisma.player.findUnique({
            where: { clerkUserId: player.clerkUserId },
          });
          if (existingClerkUser) {
            throw new Error(`Clerk User ID already exists: ${player.clerkUserId} (belongs to player ${existingClerkUser.id})`);
          }
        }

        // Prepare data - remove undefined values, keep nulls for explicit nulls
        const playerData: any = {
          gender: player.gender,
          clubId: player.clubId,
          displayAge: player.displayAge ?? true,
          displayLocation: player.displayLocation ?? true,
          isAppAdmin: player.isAppAdmin ?? false,
          disabled: player.disabled ?? false,
        };

        // Add optional fields only if they're not undefined
        if (player.firstName !== undefined) playerData.firstName = player.firstName;
        if (player.lastName !== undefined) playerData.lastName = player.lastName;
        if (player.name !== undefined) playerData.name = player.name;
        if (player.email !== undefined) playerData.email = player.email;
        if (player.phone !== undefined) playerData.phone = player.phone;
        if (player.city !== undefined) playerData.city = player.city;
        if (player.region !== undefined) playerData.region = player.region;
        if (player.country !== undefined) playerData.country = player.country;
        if (player.age !== undefined) playerData.age = player.age;
        if (player.birthday !== undefined) playerData.birthday = player.birthday;
        if (player.dupr !== undefined) playerData.dupr = player.dupr;
        if (player.duprSingles !== undefined) playerData.duprSingles = player.duprSingles;
        if (player.duprDoubles !== undefined) playerData.duprDoubles = player.duprDoubles;
        if (player.clubRatingSingles !== undefined) playerData.clubRatingSingles = player.clubRatingSingles;
        if (player.clubRatingDoubles !== undefined) playerData.clubRatingDoubles = player.clubRatingDoubles;
        if (player.clerkUserId !== undefined) playerData.clerkUserId = player.clerkUserId;
        if (player.disabledAt !== undefined) playerData.disabledAt = player.disabledAt;
        if (player.disabledBy !== undefined) playerData.disabledBy = player.disabledBy;

        // Create player (ID will be auto-generated)
        const newPlayer = await prisma.player.create({
          data: playerData,
        });

        const clubName = clubIdToName.get(player.clubId) || 'Unknown';
        const playerName = player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unknown';
        
        console.log(`✓ Created player: ${playerName} (ID: ${newPlayer.id}) - ${clubName}`);
        results.success++;

      } catch (error: any) {
        results.failed++;
        const playerName = player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim() || `Player ${i + 1}`;
        const errorMsg = error.message || String(error);
        results.errors.push(`${playerName}: ${errorMsg}`);
        console.error(`✗ Failed to create ${playerName}: ${errorMsg}`);
      }
    }

    console.log(`\n=== SUMMARY ===\n`);
    console.log(`Successfully created: ${results.success}`);
    console.log(`Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log(`\n=== ERRORS ===\n`);
      results.errors.forEach((error, idx) => {
        console.log(`${idx + 1}. ${error}`);
      });
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================
// ADD YOUR PLAYERS HERE
// ============================================

// Example: Add players manually
const newPlayers: PlayerInput[] = [
  // Example player - uncomment and modify:
  // {
  //   firstName: 'John',
  //   lastName: 'Doe',
  //   name: 'John Doe',
  //   email: 'john.doe@example.com',
  //   phone: '555-1234',
  //   gender: 'MALE',
  //   clubId: 'cmfwjxglo0000rdxtvyl80iu6', // Pickleplex Windsor - replace with actual club ID
  //   city: 'Windsor',
  //   region: 'ON',
  //   country: 'Canada',
  // },
  // Add more players here...
];

// Run the import
if (newPlayers.length > 0) {
  addPlayers(newPlayers);
} else {
  console.log('No players to add. Please add player data to the newPlayers array in the script.');
  console.log('\nExample:');
  console.log('const newPlayers: PlayerInput[] = [');
  console.log('  {');
  console.log('    firstName: "John",');
  console.log('    lastName: "Doe",');
  console.log('    name: "John Doe",');
  console.log('    email: "john.doe@example.com",');
  console.log('    gender: "MALE",');
  console.log('    clubId: "cmfwjxglo0000rdxtvyl80iu6", // Pickleplex Windsor');
  console.log('  },');
  console.log('];');
  process.exit(0);
}

