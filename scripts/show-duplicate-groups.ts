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

async function showDuplicateGroups() {
  try {
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

    // Group by first name if last name is blank/initial/?
    const firstNameMap = new Map<string, typeof allPlayers>();

    for (const player of allPlayers) {
      const firstName = (player.firstName ?? '').trim().toLowerCase();
      const lastName = (player.lastName ?? '').trim();

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
    const duplicateFirstNames = Array.from(firstNameMap.values()).filter((group) => group.length > 1);

    console.log(`\n=== ${duplicateFirstNames.length} Groups of Duplicates ===\n`);
    console.log(`(Same first name, where at least one has blank/initial/? last name)\n`);

    duplicateFirstNames.forEach((group, i) => {
      const firstName = (group[0].firstName ?? '').trim();
      console.log(`${i + 1}. "${firstName}" (${group.length} players):`);
      console.log('─'.repeat(80));
      
      group.forEach((player, j) => {
        const lastName = (player.lastName ?? '').trim();
        const isBlank = isBlankOrInitialOrQuestionMark(lastName);
        console.log(`   ${j + 1}. ${player.name || `${player.firstName} ${player.lastName}`}`);
        console.log(`      ID: ${player.id}`);
        console.log(`      First: "${player.firstName || 'null'}"`);
        console.log(`      Last: "${lastName || 'null'}" ${isBlank ? '⚠️ (blank/initial/?)' : ''}`);
        console.log(`      Email: ${player.email || 'None'}`);
        console.log(`      Clerk ID: ${player.clerkUserId || 'None'}`);
        console.log(`      Club: ${player.club?.name || 'None'}`);
        console.log(`      Created: ${player.createdAt.toISOString()}`);
        console.log('');
      });
      console.log('');
    });

    const totalPlayers = new Set<string>();
    duplicateFirstNames.forEach((group) => group.forEach((p) => totalPlayers.add(p.id)));

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total groups: ${duplicateFirstNames.length}`);
    console.log(`   Total players: ${totalPlayers.size}\n`);

  } catch (error) {
    console.error('Error showing duplicate groups:', error);
  } finally {
    await prisma.$disconnect();
  }
}

showDuplicateGroups();

