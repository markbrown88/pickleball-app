import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

function isBlankOrInitialOrQuestionMark(lastName: string | null): boolean {
  if (!lastName) return true;
  const trimmed = lastName.trim();
  return trimmed === '' || trimmed === '?' || trimmed.length === 1;
}

async function scanDuplicatePlayers() {
  try {
    console.log(`\n=== Scanning for Duplicate Players ===\n`);

    const allPlayers = await prisma.player.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        clerkUserId: true,
        club: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Total players in database: ${allPlayers.length}\n`);

    // Group 1: Same first AND last name
    const fullNameMap = new Map<string, typeof allPlayers>();
    
    // Group 2: Same first name, but last name is blank/initial/?
    // This should catch cases where one player has blank/initial/? last name and another has a proper last name
    const firstNameMap = new Map<string, typeof allPlayers>();

    for (const player of allPlayers) {
      const firstName = (player.firstName ?? '').trim().toLowerCase();
      const lastName = (player.lastName ?? '').trim();

      // Group by full name (first + last)
      if (firstName && lastName) {
        const fullNameKey = `${firstName} ${lastName.toLowerCase()}`;
        if (!fullNameMap.has(fullNameKey)) {
          fullNameMap.set(fullNameKey, []);
        }
        fullNameMap.get(fullNameKey)?.push(player);
      }

      // Group by first name if last name is blank/initial/?
      if (firstName && isBlankOrInitialOrQuestionMark(lastName)) {
        if (!firstNameMap.has(firstName)) {
          firstNameMap.set(firstName, []);
        }
        firstNameMap.get(firstName)?.push(player);
      }
    }

    // Also check: for each player with blank/initial/? last name, see if there are other players
    // with the same first name (regardless of their last name status)
    for (const player of allPlayers) {
      const firstName = (player.firstName ?? '').trim().toLowerCase();
      const lastName = (player.lastName ?? '').trim();
      
      if (firstName && isBlankOrInitialOrQuestionMark(lastName)) {
        // Find all other players with the same first name
        const sameFirstNamePlayers = allPlayers.filter(p => {
          const pFirstName = (p.firstName ?? '').trim().toLowerCase();
          return pFirstName === firstName && p.id !== player.id;
        });
        
        if (sameFirstNamePlayers.length > 0) {
          // Add this player and all others with same first name to the map
          if (!firstNameMap.has(firstName)) {
            firstNameMap.set(firstName, []);
          }
          const group = firstNameMap.get(firstName)!;
          // Add this player if not already in group
          if (!group.find(p => p.id === player.id)) {
            group.push(player);
          }
          // Add other players with same first name if not already in group
          sameFirstNamePlayers.forEach(otherPlayer => {
            if (!group.find(p => p.id === otherPlayer.id)) {
              group.push(otherPlayer);
            }
          });
        }
      }
    }

    // Filter to only groups with duplicates
    const duplicateFullNames = Array.from(fullNameMap.values()).filter((group) => group.length > 1);
    const duplicateFirstNames = Array.from(firstNameMap.values()).filter((group) => group.length > 1);

    console.log(`📊 RESULTS:\n`);
    console.log(`   Players with same first AND last name: ${duplicateFullNames.length} groups`);
    console.log(
      `   Players with same first name, blank/initial/? last name: ${duplicateFirstNames.length} groups\n`
    );

    if (duplicateFullNames.length > 0) {
      console.log(`🔍 DUPLICATES: Same First AND Last Name\n`);
      console.log(`Found ${duplicateFullNames.length} groups of duplicates:\n`);
      duplicateFullNames.forEach((group, i) => {
        const firstName = (group[0].firstName ?? '').trim();
        const lastName = (group[0].lastName ?? '').trim();
        console.log(`${i + 1}. "${firstName} ${lastName}" (${group.length} players):`);
        group.forEach((player, j) => {
          console.log(`   ${j + 1}. ID: ${player.id}`);
          console.log(`      Name: ${player.name || 'N/A'}`);
          console.log(`      Email: ${player.email || 'None'}`);
          console.log(`      Clerk User ID: ${player.clerkUserId || 'None'}`);
          console.log(`      Club: ${player.club?.name || 'None'}`);
          console.log(`      Created: ${player.createdAt.toISOString()}\n`);
        });
      });
    } else {
      console.log(`✅ No duplicates found with same first AND last name\n`);
    }

    if (duplicateFirstNames.length > 0) {
      console.log(`🔍 DUPLICATES: Same First Name, Blank/Initial/? Last Name\n`);
      console.log(`Found ${duplicateFirstNames.length} groups of duplicates:\n`);
      duplicateFirstNames.forEach((group, i) => {
        const firstName = (group[0].firstName ?? '').trim();
        console.log(`${i + 1}. "${firstName}" (${group.length} players with blank/initial/? last name):`);
        group.forEach((player, j) => {
          const lastName = (player.lastName ?? '').trim();
          console.log(`   ${j + 1}. ID: ${player.id}`);
          console.log(`      Name: ${player.name || 'N/A'}`);
          console.log(`      First Name: "${player.firstName || 'null'}"`);
          console.log(`      Last Name: "${lastName || 'null'}" ${isBlankOrInitialOrQuestionMark(lastName) ? '(blank/initial/?!)' : ''}`);
          console.log(`      Email: ${player.email || 'None'}`);
          console.log(`      Clerk User ID: ${player.clerkUserId || 'None'}`);
          console.log(`      Club: ${player.club?.name || 'None'}`);
          console.log(`      Created: ${player.createdAt.toISOString()}\n`);
        });
      });
    } else {
      console.log(`✅ No duplicates found with same first name and blank/initial/? last name\n`);
    }

    const totalDuplicatePlayers = new Set<string>();
    duplicateFullNames.forEach((group) => group.forEach((p) => totalDuplicatePlayers.add(p.id)));
    duplicateFirstNames.forEach((group) => group.forEach((p) => totalDuplicatePlayers.add(p.id)));

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total duplicate groups: ${duplicateFullNames.length + duplicateFirstNames.length}`);
    console.log(`   Total players in duplicate groups: ${totalDuplicatePlayers.size}`);
    console.log(`   Unique players involved: ${totalDuplicatePlayers.size}`);

  } catch (error) {
    console.error('Error scanning for duplicate players:', error);
  } finally {
    await prisma.$disconnect();
  }
}

scanDuplicatePlayers();

