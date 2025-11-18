import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function findDuplicates() {
  try {
    console.log('Scanning player database for potential duplicates...\n');
    console.log('='.repeat(80));

    // Get all players
    const allPlayers = await prisma.player.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        clubId: true,
        clerkUserId: true,
        createdAt: true,
      },
      orderBy: {
        firstName: 'asc',
      },
    });

    console.log(`Total players in database: ${allPlayers.length}\n`);

    // Group by first name + last name combination
    const nameCombinations = new Map<string, typeof allPlayers>();
    
    for (const player of allPlayers) {
      const firstName = (player.firstName || '').trim().toLowerCase();
      const lastName = (player.lastName || '').trim().toLowerCase();
      const key = `${firstName}|${lastName}`;
      
      if (!nameCombinations.has(key)) {
        nameCombinations.set(key, []);
      }
      nameCombinations.get(key)!.push(player);
    }

    // Find duplicates by name combination
    const duplicateNameCombos: Array<{ name: string; players: typeof allPlayers }> = [];
    
    nameCombinations.forEach((players, key) => {
      if (players.length > 1 && key !== '|') { // Ignore empty names
        const [firstName, lastName] = key.split('|');
        duplicateNameCombos.push({
          name: `${firstName} ${lastName}`,
          players,
        });
      }
    });

    // Group by first name only (for missing/null last names)
    const firstNameGroups = new Map<string, typeof allPlayers>();
    
    for (const player of allPlayers) {
      const firstName = (player.firstName || '').trim().toLowerCase();
      const lastName = (player.lastName || '').trim().toLowerCase();
      
      // Check if last name is missing, null, empty, or "?"
      if (!lastName || lastName === '' || lastName === '?' || lastName === 'null') {
        if (firstName && firstName !== '') {
          if (!firstNameGroups.has(firstName)) {
            firstNameGroups.set(firstName, []);
          }
          firstNameGroups.get(firstName)!.push(player);
        }
      }
    }

    // Find first names with multiple entries having missing/null last names
    const duplicateFirstNames: Array<{ firstName: string; players: typeof allPlayers }> = [];
    
    firstNameGroups.forEach((players, firstName) => {
      if (players.length > 1) {
        duplicateFirstNames.push({
          firstName,
          players,
        });
      }
    });

    // Get club names for display
    const clubs = await prisma.club.findMany({
      select: {
        id: true,
        name: true,
      },
    });
    const clubMap = new Map(clubs.map(c => [c.id, c.name]));

    // Output results
    console.log('='.repeat(80));
    console.log('DUPLICATES BY FIRST NAME + LAST NAME COMBINATION');
    console.log('='.repeat(80));
    
    if (duplicateNameCombos.length === 0) {
      console.log('\n✓ No duplicates found by name combination\n');
    } else {
      console.log(`\nFound ${duplicateNameCombos.length} duplicate name combination(s):\n`);
      
      duplicateNameCombos.forEach((group, idx) => {
        console.log(`\n${idx + 1}. ${group.name.toUpperCase()}`);
        console.log(`   Found ${group.players.length} player(s) with this name:\n`);
        
        group.players.forEach((player, pIdx) => {
          const clubName = player.clubId ? clubMap.get(player.clubId) || 'Unknown' : 'No club';
          const hasClerk = player.clerkUserId ? 'Yes' : 'No';
          const email = player.email || 'No email';
          const phone = player.phone || 'No phone';
          
          console.log(`   ${pIdx + 1}. ID: ${player.id}`);
          console.log(`      Name: ${player.firstName || ''} ${player.lastName || ''}`.trim() || 'N/A');
          console.log(`      Email: ${email}`);
          console.log(`      Phone: ${phone}`);
          console.log(`      Club: ${clubName}`);
          console.log(`      Has Clerk Account: ${hasClerk}`);
          console.log(`      Created: ${player.createdAt.toISOString().split('T')[0]}`);
          console.log('');
        });
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('DUPLICATES BY FIRST NAME (Missing/Null Last Names)');
    console.log('='.repeat(80));
    
    if (duplicateFirstNames.length === 0) {
      console.log('\n✓ No duplicates found by first name with missing last names\n');
    } else {
      console.log(`\nFound ${duplicateFirstNames.length} first name(s) with multiple entries having missing/null last names:\n`);
      
      duplicateFirstNames.forEach((group, idx) => {
        console.log(`\n${idx + 1}. First Name: ${group.firstName.toUpperCase()}`);
        console.log(`   Found ${group.players.length} player(s) with this first name and missing/null last name:\n`);
        
        group.players.forEach((player, pIdx) => {
          const clubName = player.clubId ? clubMap.get(player.clubId) || 'Unknown' : 'No club';
          const hasClerk = player.clerkUserId ? 'Yes' : 'No';
          const email = player.email || 'No email';
          const phone = player.phone || 'No phone';
          const lastNameDisplay = player.lastName || '(null/empty)';
          
          console.log(`   ${pIdx + 1}. ID: ${player.id}`);
          console.log(`      Name: ${player.firstName || ''} ${lastNameDisplay}`.trim());
          console.log(`      Email: ${email}`);
          console.log(`      Phone: ${phone}`);
          console.log(`      Club: ${clubName}`);
          console.log(`      Has Clerk Account: ${hasClerk}`);
          console.log(`      Created: ${player.createdAt.toISOString().split('T')[0]}`);
          console.log('');
        });
      });
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total players: ${allPlayers.length}`);
    console.log(`Duplicate name combinations: ${duplicateNameCombos.length}`);
    console.log(`First names with missing last names (multiple entries): ${duplicateFirstNames.length}`);
    
    const totalDuplicatePlayers = 
      duplicateNameCombos.reduce((sum, group) => sum + group.players.length, 0) +
      duplicateFirstNames.reduce((sum, group) => sum + group.players.length, 0);
    
    console.log(`Total players in duplicate groups: ${totalDuplicatePlayers}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findDuplicates();

