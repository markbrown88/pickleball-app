import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

const csvPath = path.join(
  process.cwd(),
  '..',
  'Downloads',
  'new_players.csv'
);

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() === 'yes';
}

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    const date = new Date(dateStr.trim());
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

function parseFloatValue(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = Number.parseFloat(value.trim());
  return isNaN(parsed) ? null : parsed;
}

function parseIntValue(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return isNaN(parsed) ? null : parsed;
}

async function addNewPlayers() {
  try {
    console.log('Reading CSV file...\n');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`Found ${records.length} new player(s) in CSV\n`);

    // Get all valid club IDs
    const clubs = await prisma.club.findMany({
      select: { id: true, name: true },
    });
    const validClubIds = new Set(clubs.map(c => c.id));
    const clubIdToName = new Map(clubs.map(c => [c.id, c.name]));

    const stats = {
      processed: 0,
      created: 0,
      skipped: 0,
      errors: 0,
    };

    const errors: string[] = [];

    for (const record of records) {
      stats.processed++;

      try {
        // Skip if ID is provided (should be empty for new players)
        const providedId = record.ID?.trim();
        if (providedId && providedId !== '') {
          stats.skipped++;
          errors.push(`Row ${stats.processed}: Player has ID "${providedId}" - skipping (use update script instead)`);
          continue;
        }

        const clubId = record['Club ID']?.trim();
        if (!clubId) {
          stats.skipped++;
          errors.push(`Row ${stats.processed}: Missing club ID`);
          continue;
        }

        // Validate club ID
        if (!validClubIds.has(clubId)) {
          stats.skipped++;
          errors.push(`Row ${stats.processed}: Invalid club ID "${clubId}"`);
          continue;
        }

        // Check for email conflicts
        const email = record.Email?.trim() || null;
        if (email) {
          const existingEmail = await prisma.player.findUnique({
            where: { email: email },
          });
          if (existingEmail) {
            stats.skipped++;
            errors.push(`Row ${stats.processed}: Email "${email}" already exists (player ${existingEmail.id})`);
            continue;
          }
        }

        // Check for clerkUserId conflicts
        const clerkUserId = record['Clerk User ID']?.trim() || null;
        if (clerkUserId) {
          const existingClerkUser = await prisma.player.findUnique({
            where: { clerkUserId: clerkUserId },
          });
          if (existingClerkUser) {
            stats.skipped++;
            errors.push(`Row ${stats.processed}: Clerk User ID "${clerkUserId}" already exists (player ${existingClerkUser.id})`);
            continue;
          }
        }

        // Validate gender
        const gender = record.Gender?.trim().toUpperCase();
        if (gender !== 'MALE' && gender !== 'FEMALE') {
          stats.skipped++;
          errors.push(`Row ${stats.processed}: Invalid gender "${record.Gender}" (must be MALE or FEMALE)`);
          continue;
        }

        // Prepare player data
        const playerData: any = {
          firstName: record['First Name']?.trim() || null,
          lastName: record['Last Name']?.trim() || null,
          name: record['Full Name']?.trim() || null,
          email: email,
          phone: record.Phone?.trim() || null,
          gender: gender as 'MALE' | 'FEMALE',
          clubId: clubId,
          clerkUserId: clerkUserId,
          city: record.City?.trim() || null,
          region: record.Region?.trim() || null,
          country: record.Country?.trim() || null,
          age: parseIntValue(record.Age),
          birthday: parseDate(record.Birthday),
          dupr: parseFloatValue(record['DUPR Overall']),
          duprSingles: parseFloatValue(record['DUPR Singles']),
          duprDoubles: parseFloatValue(record['DUPR Doubles']),
          clubRatingSingles: parseFloatValue(record['Club Rating Singles']),
          clubRatingDoubles: parseFloatValue(record['Club Rating Doubles']),
          displayAge: parseBoolean(record['Display Age']),
          displayLocation: parseBoolean(record['Display Location']),
          isAppAdmin: parseBoolean(record['Is App Admin']),
          disabled: parseBoolean(record.Disabled),
          disabledAt: parseDate(record['Disabled At']),
          disabledBy: record['Disabled By']?.trim() || null,
        };

        // Remove null values for optional fields to use defaults
        const cleanData: any = {
          gender: playerData.gender,
          clubId: playerData.clubId,
          displayAge: playerData.displayAge ?? true,
          displayLocation: playerData.displayLocation ?? true,
          isAppAdmin: playerData.isAppAdmin ?? false,
          disabled: playerData.disabled ?? false,
        };

        // Add optional fields only if they have values
        if (playerData.firstName !== null && playerData.firstName !== undefined) cleanData.firstName = playerData.firstName;
        if (playerData.lastName !== null && playerData.lastName !== undefined) cleanData.lastName = playerData.lastName;
        if (playerData.name !== null && playerData.name !== undefined) cleanData.name = playerData.name;
        if (playerData.email !== null && playerData.email !== undefined) cleanData.email = playerData.email;
        if (playerData.phone !== null && playerData.phone !== undefined) cleanData.phone = playerData.phone;
        if (playerData.city !== null && playerData.city !== undefined) cleanData.city = playerData.city;
        if (playerData.region !== null && playerData.region !== undefined) cleanData.region = playerData.region;
        if (playerData.country !== null && playerData.country !== undefined) cleanData.country = playerData.country;
        if (playerData.age !== null && playerData.age !== undefined) cleanData.age = playerData.age;
        if (playerData.birthday !== null && playerData.birthday !== undefined) cleanData.birthday = playerData.birthday;
        if (playerData.dupr !== null && playerData.dupr !== undefined) cleanData.dupr = playerData.dupr;
        if (playerData.duprSingles !== null && playerData.duprSingles !== undefined) cleanData.duprSingles = playerData.duprSingles;
        if (playerData.duprDoubles !== null && playerData.duprDoubles !== undefined) cleanData.duprDoubles = playerData.duprDoubles;
        if (playerData.clubRatingSingles !== null && playerData.clubRatingSingles !== undefined) cleanData.clubRatingSingles = playerData.clubRatingSingles;
        if (playerData.clubRatingDoubles !== null && playerData.clubRatingDoubles !== undefined) cleanData.clubRatingDoubles = playerData.clubRatingDoubles;
        if (playerData.clerkUserId !== null && playerData.clerkUserId !== undefined) cleanData.clerkUserId = playerData.clerkUserId;
        if (playerData.disabledAt !== null && playerData.disabledAt !== undefined) cleanData.disabledAt = playerData.disabledAt;
        if (playerData.disabledBy !== null && playerData.disabledBy !== undefined) cleanData.disabledBy = playerData.disabledBy;

        // Create player (ID will be auto-generated by Prisma)
        const newPlayer = await prisma.player.create({
          data: cleanData,
        });

        const clubName = clubIdToName.get(clubId) || 'Unknown';
        const playerName = playerData.name || `${playerData.firstName || ''} ${playerData.lastName || ''}`.trim() || 'Unknown';
        
        console.log(`✓ Created: ${playerName} (ID: ${newPlayer.id}) - ${clubName}`);
        stats.created++;

      } catch (error: any) {
        stats.errors++;
        const playerName = record['Full Name']?.trim() || `${record['First Name'] || ''} ${record['Last Name'] || ''}`.trim() || `Row ${stats.processed}`;
        const errorMsg = error.message || String(error);
        errors.push(`${playerName}: ${errorMsg}`);
        console.error(`✗ Error creating ${playerName}: ${errorMsg}`);
      }
    }

    console.log('\n=== IMPORT SUMMARY ===\n');
    console.log(`Total records processed: ${stats.processed}`);
    console.log(`  - Created: ${stats.created}`);
    console.log(`  - Skipped: ${stats.skipped}`);
    console.log(`  - Errors: ${stats.errors}`);

    if (errors.length > 0) {
      console.log(`\n=== ERRORS ===\n`);
      errors.forEach((error, idx) => {
        console.log(`${idx + 1}. ${error}`);
      });
    } else {
      console.log('\n✓ All players created successfully!');
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addNewPlayers();

