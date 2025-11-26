import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function scanNameDuplicates() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('SCANNING FOR DUPLICATE PLAYERS BY NAME');
    console.log('='.repeat(80));
    console.log('\nFetching all players...\n');

    const allPlayers = await prisma.player.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        phone: true,
        clerkUserId: true,
        city: true,
        region: true,
        duprDoubles: true,
        clubId: true,
        createdAt: true,
        club: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    console.log(`Total players in database: ${allPlayers.length}\n`);

    // Normalize names for comparison
    const normalize = (str: string | null | undefined): string => {
      if (!str) return '';
      return str.trim().toLowerCase();
    };

    // Get last name initial
    const getLastNameInitial = (lastName: string | null | undefined): string => {
      if (!lastName) return '';
      const trimmed = lastName.trim();
      if (trimmed.length === 0) return '';
      return trimmed[0].toLowerCase();
    };

    // Group 1: Exact first + last name matches
    const exactMatches = new Map<string, typeof allPlayers>();
    
    // Group 2: First name + last name initial matches
    const initialMatches = new Map<string, typeof allPlayers>();

    for (const player of allPlayers) {
      const firstName = normalize(player.firstName);
      const lastName = normalize(player.lastName);
      const lastInitial = getLastNameInitial(player.lastName);

      // Skip if no first name
      if (!firstName) continue;

      // Group 1: Exact first + last name
      if (lastName && lastName.length > 1) {
        // Only consider if last name is more than 1 character (not just an initial)
        const exactKey = `${firstName}|${lastName}`;
        if (!exactMatches.has(exactKey)) {
          exactMatches.set(exactKey, []);
        }
        exactMatches.get(exactKey)!.push(player);
      }

      // Group 2: First name + last name initial
      if (lastInitial) {
        const initialKey = `${firstName}|${lastInitial}`;
        if (!initialMatches.has(initialKey)) {
          initialMatches.set(initialKey, []);
        }
        initialMatches.get(initialKey)!.push(player);
      }
    }

    // Filter to only groups with 2+ players
    const duplicateExact = Array.from(exactMatches.entries())
      .filter(([_, players]) => players.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    const duplicateInitial = Array.from(initialMatches.entries())
      .filter(([_, players]) => {
        // Only include if there are 2+ players AND at least one has a full last name
        // (to avoid flagging all "John S" entries when they're all just initials)
        if (players.length < 2) return false;
        const hasFullLastName = players.some(p => {
          const ln = normalize(p.lastName);
          return ln && ln.length > 1;
        });
        return hasFullLastName;
      })
      .sort((a, b) => b[1].length - a[1].length);

    console.log('='.repeat(80));
    console.log('RESULTS');
    console.log('='.repeat(80));
    console.log(`\nExact first + last name duplicates: ${duplicateExact.length} groups`);
    console.log(`First name + last initial duplicates: ${duplicateInitial.length} groups\n`);

    // Display exact matches
    if (duplicateExact.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('🔴 EXACT FIRST + LAST NAME DUPLICATES');
      console.log('='.repeat(80));
      
      duplicateExact.forEach(([key, players], idx) => {
        const [firstName, lastName] = key.split('|');
        console.log(`\n${idx + 1}. ${firstName} ${lastName} (${players.length} players):`);
        console.log('-'.repeat(80));
        
        players.forEach((player, pIdx) => {
          const displayName = player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unknown';
          const hasClerk = player.clerkUserId ? 'Yes' : 'No';
          const email = player.email || 'None';
          const phone = player.phone || 'None';
          const location = player.city && player.region ? `${player.city}, ${player.region}` : (player.city || player.region || 'None');
          const dupr = player.duprDoubles ? player.duprDoubles.toString() : 'None';
          const club = player.club?.name || 'None';
          
          console.log(`\n   ${pIdx + 1}. ID: ${player.id}`);
          console.log(`      Name: ${displayName}`);
          console.log(`      Email: ${email}`);
          console.log(`      Phone: ${phone}`);
          console.log(`      Location: ${location}`);
          console.log(`      DUPR Doubles: ${dupr}`);
          console.log(`      Club: ${club}`);
          console.log(`      Has Clerk Account: ${hasClerk}`);
          console.log(`      Created: ${player.createdAt.toISOString().split('T')[0]}`);
        });
      });
    } else {
      console.log('\n✅ No exact first + last name duplicates found');
    }

    // Display initial matches
    if (duplicateInitial.length > 0) {
      console.log('\n\n' + '='.repeat(80));
      console.log('🟡 FIRST NAME + LAST INITIAL DUPLICATES');
      console.log('='.repeat(80));
      console.log('(Same first name, last name starts with same letter)');
      
      duplicateInitial.forEach(([key, players], idx) => {
        const [firstName, lastInitial] = key.split('|');
        console.log(`\n${idx + 1}. ${firstName} ${lastInitial.toUpperCase()}* (${players.length} players):`);
        console.log('-'.repeat(80));
        
        players.forEach((player, pIdx) => {
          const displayName = player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unknown';
          const hasClerk = player.clerkUserId ? 'Yes' : 'No';
          const email = player.email || 'None';
          const phone = player.phone || 'None';
          const location = player.city && player.region ? `${player.city}, ${player.region}` : (player.city || player.region || 'None');
          const dupr = player.duprDoubles ? player.duprDoubles.toString() : 'None';
          const club = player.club?.name || 'None';
          const lastName = normalize(player.lastName);
          const isInitial = lastName.length <= 1;
          
          console.log(`\n   ${pIdx + 1}. ID: ${player.id}`);
          console.log(`      Name: ${displayName} ${isInitial ? '⚠️ (last name is just initial)' : ''}`);
          console.log(`      Email: ${email}`);
          console.log(`      Phone: ${phone}`);
          console.log(`      Location: ${location}`);
          console.log(`      DUPR Doubles: ${dupr}`);
          console.log(`      Club: ${club}`);
          console.log(`      Has Clerk Account: ${hasClerk}`);
          console.log(`      Created: ${player.createdAt.toISOString().split('T')[0]}`);
        });
      });
    } else {
      console.log('\n✅ No first name + last initial duplicates found');
    }

    // Summary
    const totalDuplicatePlayers = new Set<string>();
    duplicateExact.forEach(([_, players]) => players.forEach(p => totalDuplicatePlayers.add(p.id)));
    duplicateInitial.forEach(([_, players]) => players.forEach(p => totalDuplicatePlayers.add(p.id)));

    console.log('\n\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total players scanned: ${allPlayers.length}`);
    console.log(`Exact name duplicate groups: ${duplicateExact.length}`);
    console.log(`Initial name duplicate groups: ${duplicateInitial.length}`);
    console.log(`Total unique players in duplicate groups: ${totalDuplicatePlayers.size}`);
    
    // Count how many have Clerk accounts vs don't
    let withClerk = 0;
    let withoutClerk = 0;
    totalDuplicatePlayers.forEach(playerId => {
      const player = allPlayers.find(p => p.id === playerId);
      if (player) {
        if (player.clerkUserId) withClerk++;
        else withoutClerk++;
      }
    });
    console.log(`  - With Clerk account: ${withClerk}`);
    console.log(`  - Without Clerk account: ${withoutClerk}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

scanNameDuplicates();

