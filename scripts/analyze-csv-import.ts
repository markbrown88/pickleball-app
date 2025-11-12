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

async function analyzeCSV() {
  try {
    console.log('Reading CSV file...\n');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      cast: false, // Keep as strings for analysis
    });

    console.log(`Found ${records.length} records in CSV\n`);

    // Get all existing players
    const existingPlayers = await prisma.player.findMany({
      select: {
        id: true,
        email: true,
        clerkUserId: true,
        firstName: true,
        lastName: true,
      },
    });

    const existingPlayerIds = new Set(existingPlayers.map(p => p.id));
    const existingEmails = new Map(existingPlayers.map(p => [p.email?.toLowerCase(), p.id]));
    const existingClerkUserIds = new Map(existingPlayers.map(p => [p.clerkUserId, p.id]));

    // Get all club IDs
    const clubs = await prisma.club.findMany({
      select: { id: true, name: true },
    });
    const validClubIds = new Set(clubs.map(c => c.id));
    const clubIdToName = new Map(clubs.map(c => [c.id, c.name]));

    // Analysis
    const issues: string[] = [];
    const stats = {
      total: records.length,
      willUpdate: 0,
      willCreate: 0,
      missingClubId: 0,
      invalidClubId: 0,
      emailConflicts: 0,
      clerkUserIdConflicts: 0,
      invalidBirthday: 0,
      invalidBoolean: 0,
      statusDistribution: {} as Record<string, number>,
    };

    for (const record of records) {
      const playerId = record.ID?.trim();
      const email = record.Email?.trim() || null;
      const clerkUserId = record['Clerk User ID']?.trim() || null;
      const clubId = record['Club ID']?.trim();
      const status = record.Status?.trim();

      // Status distribution
      stats.statusDistribution[status] = (stats.statusDistribution[status] || 0) + 1;

      // Check if player exists
      if (existingPlayerIds.has(playerId)) {
        stats.willUpdate++;
      } else {
        stats.willCreate++;
      }

      // Check club ID
      if (!clubId) {
        stats.missingClubId++;
        issues.push(`Player ${playerId} (${record['First Name']} ${record['Last Name']}): Missing Club ID`);
      } else if (!validClubIds.has(clubId)) {
        stats.invalidClubId++;
        issues.push(`Player ${playerId} (${record['First Name']} ${record['Last Name']}): Invalid Club ID "${clubId}"`);
      }

      // Check email conflicts (if email exists but belongs to different player)
      if (email) {
        const existingPlayerId = existingEmails.get(email.toLowerCase());
        if (existingPlayerId && existingPlayerId !== playerId) {
          stats.emailConflicts++;
          issues.push(`Player ${playerId}: Email "${email}" already belongs to player ${existingPlayerId}`);
        }
      }

      // Check clerkUserId conflicts
      if (clerkUserId) {
        const existingPlayerId = existingClerkUserIds.get(clerkUserId);
        if (existingPlayerId && existingPlayerId !== playerId) {
          stats.clerkUserIdConflicts++;
          issues.push(`Player ${playerId}: Clerk User ID "${clerkUserId}" already belongs to player ${existingPlayerId}`);
        }
      }

      // Check birthday format
      const birthday = record.Birthday?.trim();
      if (birthday && birthday !== '') {
        // Try to parse various formats
        const dateStr = birthday;
        // Check if it's a valid date format (YYYY-MM-DD or ISO format)
        if (!dateStr.match(/^\d{4}-\d{2}-\d{2}/) && !dateStr.match(/^\d{4}-\d{2}-\d{2}T/)) {
          stats.invalidBirthday++;
          issues.push(`Player ${playerId}: Invalid birthday format "${birthday}"`);
        }
      }

      // Check boolean fields
      const booleanFields = ['Display Age', 'Display Location', 'Is App Admin', 'Disabled'];
      for (const field of booleanFields) {
        const value = record[field]?.trim();
        if (value && value !== '' && value !== 'Yes' && value !== 'No') {
          stats.invalidBoolean++;
          issues.push(`Player ${playerId}: Invalid boolean value for "${field}": "${value}"`);
        }
      }
    }

    // Print summary
    console.log('=== IMPORT ANALYSIS SUMMARY ===\n');
    console.log(`Total records: ${stats.total}`);
    console.log(`  - Will UPDATE: ${stats.willUpdate}`);
    console.log(`  - Will CREATE: ${stats.willCreate}`);
    console.log(`\nStatus Distribution:`);
    for (const [status, count] of Object.entries(stats.statusDistribution)) {
      console.log(`  - ${status}: ${count}`);
    }

    console.log(`\n=== POTENTIAL ISSUES ===\n`);
    console.log(`Missing Club ID: ${stats.missingClubId}`);
    console.log(`Invalid Club ID: ${stats.invalidClubId}`);
    console.log(`Email Conflicts: ${stats.emailConflicts}`);
    console.log(`Clerk User ID Conflicts: ${stats.clerkUserIdConflicts}`);
    console.log(`Invalid Birthday Format: ${stats.invalidBirthday}`);
    console.log(`Invalid Boolean Values: ${stats.invalidBoolean}`);

    if (issues.length > 0) {
      console.log(`\n=== DETAILED ISSUES (First 20) ===\n`);
      issues.slice(0, 20).forEach((issue, idx) => {
        console.log(`${idx + 1}. ${issue}`);
      });
      if (issues.length > 20) {
        console.log(`\n... and ${issues.length - 20} more issues`);
      }
    } else {
      console.log('\n✓ No issues found!');
    }

    // Questions/Recommendations
    console.log(`\n=== QUESTIONS & RECOMMENDATIONS ===\n`);
    console.log('1. STATUS COLUMN:');
    console.log('   The CSV has a "Status" column with values: "Maybe to Merge", "Merged", "Old (Unchanged)"');
    console.log('   This column does not exist in the Player schema.');
    console.log('   → Should we ignore this column during import?');
    console.log('   → Or do you want to handle these records differently based on status?');

    console.log('\n2. BIRTHDAY PARSING:');
    console.log('   CSV has birthdays in format "YYYY-MM-DD" (e.g., "1994-06-18")');
    console.log('   Database expects DateTime. We can parse these correctly.');
    console.log('   → Should we parse and store as DateTime?');

    console.log('\n3. BOOLEAN VALUES:');
    console.log('   CSV uses "Yes"/"No" strings, database expects boolean.');
    console.log('   → We will convert: "Yes" → true, "No"/empty → false');

    console.log('\n4. FULL NAME vs FIRST/LAST NAME:');
    console.log('   CSV has both "Full Name" and separate "First Name"/"Last Name"');
    console.log('   Database has: name (String?), firstName (String?), lastName (String?)');
    console.log('   → Should we use "Full Name" for the "name" field?');

    console.log('\n5. CREATED/UPDATED TIMESTAMPS:');
    console.log('   CSV has "Created At" and "Updated At" timestamps');
    console.log('   → Should we preserve these timestamps or use current time?');

    if (stats.statusDistribution['Maybe to Merge']) {
      console.log('\n⚠️  WARNING:');
      console.log(`   Found ${stats.statusDistribution['Maybe to Merge']} records with status "Maybe to Merge"`);
      console.log('   These might be duplicate candidates. Consider reviewing before import.');
    }

  } catch (error) {
    console.error('Error analyzing CSV:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeCSV();

