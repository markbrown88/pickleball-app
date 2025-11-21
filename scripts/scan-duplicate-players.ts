import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function scanDuplicatePlayers() {
  try {
    console.log(`\n=== Scanning for Duplicate Players ===\n`);

    // Get all players
    const allPlayers = await prisma.player.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        clerkUserId: true,
        createdAt: true,
        clubId: true,
        club: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`Total players in database: ${allPlayers.length}\n`);

    // Normalize names for comparison
    const normalizeName = (name: string | null | undefined): string => {
      if (!name) return '';
      return name.trim().toLowerCase();
    };

    // Group 1: Same first name AND last name
    const sameFirstLast = new Map<string, typeof allPlayers>();
    
    // Group 2: Same first name, missing last name (null or empty)
    const sameFirstMissingLast = new Map<string, typeof allPlayers>();

    for (const player of allPlayers) {
      const firstName = normalizeName(player.firstName);
      const lastName = normalizeName(player.lastName);

      // Skip if no first name
      if (!firstName) continue;

      // Group 1: Same first AND last name
      if (lastName) {
        const key = `${firstName}|${lastName}`;
        if (!sameFirstLast.has(key)) {
          sameFirstLast.set(key, []);
        }
        sameFirstLast.get(key)!.push(player);
      }

      // Group 2: Same first name, missing last name
      if (!lastName || lastName === '') {
        if (!sameFirstMissingLast.has(firstName)) {
          sameFirstMissingLast.set(firstName, []);
        }
        sameFirstMissingLast.get(firstName)!.push(player);
      }
    }

    // Filter to only show groups with 2+ players
    const duplicateFirstLast = Array.from(sameFirstLast.entries())
      .filter(([_, players]) => players.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    const duplicateFirstMissingLast = Array.from(sameFirstMissingLast.entries())
      .filter(([_, players]) => players.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    console.log(`📊 RESULTS:\n`);
    console.log(`   Players with same first AND last name: ${duplicateFirstLast.length} groups`);
    console.log(`   Players with same first name, missing last name: ${duplicateFirstMissingLast.length} groups\n`);

    // Display same first AND last name duplicates
    if (duplicateFirstLast.length > 0) {
      console.log(`\n🔍 DUPLICATES: Same First AND Last Name\n`);
      console.log(`Found ${duplicateFirstLast.length} groups of duplicates:\n`);

      duplicateFirstLast.forEach(([key, players], idx) => {
        const [firstName, lastName] = key.split('|');
        console.log(`${idx + 1}. "${firstName} ${lastName}" (${players.length} players):`);
        
        players.forEach((player, pIdx) => {
          const displayName = player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unknown';
          console.log(`   ${pIdx + 1}. ID: ${player.id}`);
          console.log(`      Name: ${displayName}`);
          console.log(`      Email: ${player.email || 'None'}`);
          console.log(`      Clerk User ID: ${player.clerkUserId || 'None'}`);
          console.log(`      Club: ${player.club?.name || 'None'}`);
          console.log(`      Created: ${player.createdAt.toISOString()}`);
          console.log('');
        });
      });
    } else {
      console.log(`✅ No duplicates found with same first AND last name\n`);
    }

    // Display same first name, missing last name duplicates
    if (duplicateFirstMissingLast.length > 0) {
      console.log(`\n🔍 DUPLICATES: Same First Name, Missing Last Name\n`);
      console.log(`Found ${duplicateFirstMissingLast.length} groups:\n`);

      duplicateFirstMissingLast.forEach(([firstName, players], idx) => {
        console.log(`${idx + 1}. First Name: "${firstName}" (${players.length} players, all missing last name):`);
        
        players.forEach((player, pIdx) => {
          const displayName = player.name || player.firstName || 'Unknown';
          console.log(`   ${pIdx + 1}. ID: ${player.id}`);
          console.log(`      Name: ${displayName}`);
          console.log(`      Email: ${player.email || 'None'}`);
          console.log(`      Clerk User ID: ${player.clerkUserId || 'None'}`);
          console.log(`      Club: ${player.club?.name || 'None'}`);
          console.log(`      Created: ${player.createdAt.toISOString()}`);
          console.log('');
        });
      });
    } else {
      console.log(`✅ No duplicates found with same first name and missing last name\n`);
    }

    // Summary statistics
    const totalDuplicatePlayers = 
      duplicateFirstLast.reduce((sum, [_, players]) => sum + players.length, 0) +
      duplicateFirstMissingLast.reduce((sum, [_, players]) => sum + players.length, 0);
    
    const uniqueDuplicatePlayers = new Set([
      ...duplicateFirstLast.flatMap(([_, players]) => players.map(p => p.id)),
      ...duplicateFirstMissingLast.flatMap(([_, players]) => players.map(p => p.id))
    ]);

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total duplicate groups: ${duplicateFirstLast.length + duplicateFirstMissingLast.length}`);
    console.log(`   Total players in duplicate groups: ${totalDuplicatePlayers}`);
    console.log(`   Unique players involved: ${uniqueDuplicatePlayers.size}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

scanDuplicatePlayers();

