import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

const csvPath = path.join(
  process.cwd(),
  '..',
  'Downloads',
  'players-merged-deduped-with-status-2025-11-11 - players-merged-deduped-with-status-2025-11-11.csv'
);

// Map old Windsor club IDs to current Windsor club ID
const WINDSOR_CLUB_ID = 'cmfwjxglo0000rdxtvyl80iu6';
const OLD_WINDSOR_IDS = [
  'cmfwjxglo0000rdxtvyl80iu7',
  'cmfwjxglo0000rdxtvyl80iu8',
  'cmfwjxglo0000rdxtvyl80iu9',
  'cmfwjxglo0000rdxtvyl80iu10',
  'cmfwjxglo0000rdxtvyl80iu11',
  'cmfwjxglo0000rdxtvyl80iu12',
  'cmfwjxglo0000rdxtvyl80iu13',
  'cmfwjxglo0000rdxtvyl80iu14',
  'cmfwjxglo0000rdxtvyl80iu15',
  'cmfwjxglo0000rdxtvyl80iu16',
  'cmfwjxglo0000rdxtvyl80iu17',
  'cmfwjxglo0000rdxtvyl80iu18',
];

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() === 'yes';
}

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    // Handle YYYY-MM-DD format
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

function fixClubId(clubId: string | undefined): string | null {
  if (!clubId) return null;
  const trimmed = clubId.trim();
  if (OLD_WINDSOR_IDS.includes(trimmed)) {
    return WINDSOR_CLUB_ID;
  }
  return trimmed;
}

async function importPlayers() {
  try {
    console.log('Reading CSV file...\n');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`Found ${records.length} records in CSV\n`);

    // Get all valid club IDs
    const clubs = await prisma.club.findMany({
      select: { id: true },
    });
    const validClubIds = new Set(clubs.map(c => c.id));

    const stats = {
      processed: 0,
      updated: 0,
      created: 0,
      skipped: 0,
      errors: 0,
    };

    const errors: string[] = [];

    // Player ID to skip (was deleted earlier)
    const SKIP_PLAYER_ID = 'cmh822aue004br0j4lrp6nuic';

    for (const record of records) {
      stats.processed++;

      try {
        const playerId = record.ID?.trim();
        if (!playerId) {
          stats.skipped++;
          errors.push(`Row ${stats.processed}: Missing player ID`);
          continue;
        }

        // Skip the deleted player
        if (playerId === SKIP_PLAYER_ID) {
          stats.skipped++;
          console.log(`Skipping deleted player: ${playerId} (Lisa Dadd)`);
          continue;
        }

        // Fix club ID if needed
        let clubId = fixClubId(record['Club ID']?.trim());
        if (!clubId) {
          stats.skipped++;
          errors.push(`Player ${playerId}: Missing club ID`);
          continue;
        }

        // Validate club ID
        if (!validClubIds.has(clubId)) {
          stats.skipped++;
          errors.push(`Player ${playerId}: Invalid club ID "${clubId}"`);
          continue;
        }

        // Check if player exists
        const existingPlayer = await prisma.player.findUnique({
          where: { id: playerId },
        });

        const data = {
          firstName: record['First Name']?.trim() || null,
          lastName: record['Last Name']?.trim() || null,
          name: record['Full Name']?.trim() || null,
          email: record.Email?.trim() || null,
          phone: record.Phone?.trim() || null,
          gender: record.Gender?.trim().toUpperCase() as 'MALE' | 'FEMALE' | null,
          clubId: clubId,
          clerkUserId: record['Clerk User ID']?.trim() || null,
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
          updatedAt: new Date(), // Always use current time
        };

        // Remove null/undefined values to avoid overwriting with null
        const cleanData: any = {};
        for (const [key, value] of Object.entries(data)) {
          if (value !== null && value !== undefined) {
            cleanData[key] = value;
          }
        }

        if (existingPlayer) {
          // Update existing player
          // Check for email conflicts - if email exists for different player, skip email update
          if (cleanData.email) {
            const emailConflict = await prisma.player.findFirst({
              where: {
                email: cleanData.email,
                id: { not: playerId },
              },
            });
            if (emailConflict) {
              // Skip email update if it conflicts
              delete cleanData.email;
            }
          }
          
          await prisma.player.update({
            where: { id: playerId },
            data: cleanData,
          });
          stats.updated++;
        } else {
          // Create new player
          // Gender is required, so set a default if missing
          if (!cleanData.gender) {
            cleanData.gender = 'MALE'; // Default, but this shouldn't happen
          }
          
          await prisma.player.create({
            data: {
              id: playerId,
              ...cleanData,
            },
          });
          stats.created++;
        }

        if (stats.processed % 50 === 0) {
          console.log(`Processed ${stats.processed}/${records.length} records...`);
        }

      } catch (error: any) {
        stats.errors++;
        const playerId = record.ID?.trim() || 'Unknown';
        const errorMsg = error.message || String(error);
        errors.push(`Player ${playerId}: ${errorMsg}`);
        console.error(`Error processing player ${playerId}:`, errorMsg);
      }
    }

    console.log('\n=== IMPORT SUMMARY ===\n');
    console.log(`Total records processed: ${stats.processed}`);
    console.log(`  - Updated: ${stats.updated}`);
    console.log(`  - Created: ${stats.created}`);
    console.log(`  - Skipped: ${stats.skipped}`);
    console.log(`  - Errors: ${stats.errors}`);

    if (errors.length > 0) {
      console.log(`\n=== ERRORS (First 20) ===\n`);
      errors.slice(0, 20).forEach((error, idx) => {
        console.log(`${idx + 1}. ${error}`);
      });
      if (errors.length > 20) {
        console.log(`\n... and ${errors.length - 20} more errors`);
      }
    } else {
      console.log('\n✓ No errors!');
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importPlayers();

