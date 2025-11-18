import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// Tournament and Stop IDs (from lookup)
const TOURNAMENT_ID = 'cmh7qeb1t0000ju04udwe7w8w'; // KLYNG CUP - pickleplex
const OSHAWA_STOP_ID = 'cmh7rtx46000jl804twvhjt1p'; // Oshawa stop

// Bracket mapping (name -> ID)
const BRACKET_MAP: Record<string, string> = {
  '2.5': 'cmh7rtwp30009l804ui4dpbfr',
  '3': 'cmh7rtwqa000bl804nyeg69n8',
  '3.0': 'cmh7rtwqa000bl804nyeg69n8',
  '3.5': 'cmh7rtwr6000dl804wpyus6jn',
  '4.0+': 'cmh7rtws2000fl804vjxd1xlm',
  '4.0': 'cmh7rtws2000fl804vjxd1xlm',
};

// Club name mapping (CSV name -> DB name)
const CLUB_NAME_MAP: Record<string, string> = {
  'Downsview': 'Pickleplex Downsview',
  'Barrie': 'Pickleplex Barrie',
  'Promenade': 'Pickleplex Promenade',
  'Oshawa': 'Pickleplex Oshawa',
};

type CSVRecord = {
  'Name (First)'?: string;
  'Name (Last)'?: string;
  Email?: string;
  Phone?: string;
  'Date of Birth'?: string;
  'Gender (for team balance)'?: string;
  'Current DUPR Singles Rating'?: string;
  'Current DUPR Doubles Rating'?: string;
  'Current Club Singles Rating'?: string;
  'Current Club Doubles Rating'?: string;
  'Bracket for Klyng Cup'?: string;
  'Which Pickleplex Club would you like to represent?'?: string;
};

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

function normalizePhone(phone: string | undefined): string | null {
  if (!phone || phone.trim() === '') return null;
  // Remove dashes and spaces
  return phone.replace(/[\s\-]/g, '');
}

async function importPlayers() {
  try {
    const csvPath = path.join(
      process.cwd(),
      '..',
      'Downloads',
      'klyng-cup-–-pickleplex-edition-player-registration-2025-11-17 - klyng-cup-–-pickleplex-edition-player-registration-2025-11-17.csv'
    );

    console.log('Reading CSV file...\n');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    }) as CSVRecord[];

    console.log(`Found ${records.length} records in CSV\n`);

    // Get clubs
    const clubs = await prisma.club.findMany({
      where: {
        name: {
          in: Object.values(CLUB_NAME_MAP),
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const clubNameToId = new Map<string, string>();
    clubs.forEach(club => {
      clubNameToId.set(club.name, club.id);
    });

    // Reverse map: CSV name -> DB ID
    const csvClubToId = new Map<string, string>();
    Object.entries(CLUB_NAME_MAP).forEach(([csvName, dbName]) => {
      const clubId = clubNameToId.get(dbName);
      if (clubId) {
        csvClubToId.set(csvName, clubId);
      }
    });

    console.log('Club Mapping:');
    csvClubToId.forEach((id, csvName) => {
      const dbName = CLUB_NAME_MAP[csvName];
      console.log(`   ${csvName} -> ${dbName} (ID: ${id})`);
    });
    console.log('');

    // Verify tournament and stop exist
    const tournament = await prisma.tournament.findUnique({
      where: { id: TOURNAMENT_ID },
      select: { name: true, type: true },
    });

    if (!tournament) {
      throw new Error(`Tournament ${TOURNAMENT_ID} not found`);
    }

    const stop = await prisma.stop.findUnique({
      where: { id: OSHAWA_STOP_ID },
      select: { name: true, tournamentId: true },
    });

    if (!stop) {
      throw new Error(`Stop ${OSHAWA_STOP_ID} not found`);
    }

    if (stop.tournamentId !== TOURNAMENT_ID) {
      throw new Error(`Stop ${OSHAWA_STOP_ID} does not belong to tournament ${TOURNAMENT_ID}`);
    }

    console.log(`Tournament: ${tournament.name}`);
    console.log(`Stop: ${stop.name} (ID: ${OSHAWA_STOP_ID})\n`);

    const stats = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      rosterEntriesCreated: 0,
      rosterEntriesSkipped: 0,
    };

    const errors: string[] = [];
    const seenEmails = new Set<string>();

    for (const record of records) {
      stats.processed++;

      const email = record.Email?.trim().toLowerCase();
      if (!email) {
        stats.skipped++;
        errors.push(`Row ${stats.processed}: Missing email`);
        continue;
      }

      // Check for duplicates within CSV
      if (seenEmails.has(email)) {
        stats.skipped++;
        console.log(`⚠️  Skipping duplicate: ${email} (already processed)`);
        continue;
      }
      seenEmails.add(email);

      // Validate required fields
      const firstName = record['Name (First)']?.trim();
      const lastName = record['Name (Last)']?.trim();
      const gender = record['Gender (for team balance)']?.trim().toUpperCase();

      if (!firstName || !lastName) {
        stats.skipped++;
        errors.push(`Row ${stats.processed} (${email}): Missing first or last name`);
        continue;
      }

      if (gender !== 'MALE' && gender !== 'FEMALE') {
        stats.skipped++;
        errors.push(`Row ${stats.processed} (${email}): Invalid gender "${gender}"`);
        continue;
      }

      // Get club ID
      const csvClubName = record['Which Pickleplex Club would you like to represent?']?.trim();
      if (!csvClubName) {
        stats.skipped++;
        errors.push(`Row ${stats.processed} (${email}): Missing club name`);
        continue;
      }

      const clubId = csvClubToId.get(csvClubName);
      if (!clubId) {
        stats.skipped++;
        errors.push(`Row ${stats.processed} (${email}): Club "${csvClubName}" not found`);
        continue;
      }

      // Get bracket ID
      const bracketName = record['Bracket for Klyng Cup']?.trim();
      if (!bracketName) {
        stats.skipped++;
        errors.push(`Row ${stats.processed} (${email}): Missing bracket`);
        continue;
      }

      const bracketId = BRACKET_MAP[bracketName];
      if (!bracketId) {
        stats.skipped++;
        errors.push(`Row ${stats.processed} (${email}): Unknown bracket "${bracketName}"`);
        continue;
      }

      try {
        // Check if player exists
        const existingPlayer = await prisma.player.findUnique({
          where: { email },
        });

        let playerId: string;

        if (existingPlayer) {
          // Update existing player
          const updateData: any = {
            firstName,
            lastName,
            name: `${firstName} ${lastName}`,
            gender: gender as 'MALE' | 'FEMALE',
            clubId, // Update club
          };

          // Only update optional fields if provided
          if (record.Phone) {
            updateData.phone = normalizePhone(record.Phone);
          }
          if (record['Date of Birth']) {
            updateData.birthday = parseDate(record['Date of Birth']);
          }
          if (record['Current DUPR Singles Rating']) {
            updateData.duprSingles = parseFloatValue(record['Current DUPR Singles Rating']);
          }
          if (record['Current DUPR Doubles Rating']) {
            updateData.duprDoubles = parseFloatValue(record['Current DUPR Doubles Rating']);
          }
          if (record['Current Club Singles Rating']) {
            updateData.clubRatingSingles = parseFloatValue(record['Current Club Singles Rating']);
          }
          if (record['Current Club Doubles Rating']) {
            updateData.clubRatingDoubles = parseFloatValue(record['Current Club Doubles Rating']);
          }

          await prisma.player.update({
            where: { id: existingPlayer.id },
            data: updateData,
          });

          playerId = existingPlayer.id;
          stats.updated++;
          console.log(`✓ Updated: ${firstName} ${lastName} (${email})`);
        } else {
          // Create new player
          const playerData: any = {
            email,
            firstName,
            lastName,
            name: `${firstName} ${lastName}`,
            gender: gender as 'MALE' | 'FEMALE',
            clubId, // Primary club
            phone: normalizePhone(record.Phone),
            birthday: parseDate(record['Date of Birth']),
            duprSingles: parseFloatValue(record['Current DUPR Singles Rating']),
            duprDoubles: parseFloatValue(record['Current DUPR Doubles Rating']),
            clubRatingSingles: parseFloatValue(record['Current Club Singles Rating']),
            clubRatingDoubles: parseFloatValue(record['Current Club Doubles Rating']),
          };

          // Remove null values
          Object.keys(playerData).forEach(key => {
            if (playerData[key] === null || playerData[key] === undefined) {
              delete playerData[key];
            }
          });

          const newPlayer = await prisma.player.create({
            data: playerData,
          });

          playerId = newPlayer.id;
          stats.created++;
          console.log(`✓ Created: ${firstName} ${lastName} (${email})`);
        }

        // Create roster entry (StopTeamPlayer)
        // First, find or create the team for this club and bracket
        let team = await prisma.team.findFirst({
          where: {
            tournamentId: TOURNAMENT_ID,
            clubId: clubId,
            bracketId: bracketId,
          },
        });

        if (!team) {
          // Get bracket name for team name
          const bracket = await prisma.tournamentBracket.findUnique({
            where: { id: bracketId },
            select: { name: true },
          });

          const club = await prisma.club.findUnique({
            where: { id: clubId },
            select: { name: true },
          });

          const teamName = bracket?.name === 'DEFAULT' 
            ? club?.name || 'Team'
            : `${club?.name || 'Team'} ${bracket?.name || ''}`;

          team = await prisma.team.create({
            data: {
              name: teamName,
              tournamentId: TOURNAMENT_ID,
              clubId: clubId,
              bracketId: bracketId,
            },
          });
        }

        // Check if roster entry already exists
        const existingRosterEntry = await prisma.stopTeamPlayer.findUnique({
          where: {
            stopId_teamId_playerId: {
              stopId: OSHAWA_STOP_ID,
              teamId: team.id,
              playerId: playerId,
            },
          },
        });

        if (!existingRosterEntry) {
          await prisma.stopTeamPlayer.create({
            data: {
              stopId: OSHAWA_STOP_ID,
              teamId: team.id,
              playerId: playerId,
            },
          });
          stats.rosterEntriesCreated++;
          console.log(`   → Added to roster: ${bracketName} bracket`);
        } else {
          stats.rosterEntriesSkipped++;
          console.log(`   → Already in roster: ${bracketName} bracket`);
        }

      } catch (error: any) {
        stats.errors++;
        const errorMsg = error.message || String(error);
        errors.push(`${email}: ${errorMsg}`);
        console.error(`✗ Error processing ${email}: ${errorMsg}`);
      }
    }

    console.log('\n\n=== IMPORT SUMMARY ===\n');
    console.log(`Total records processed: ${stats.processed}`);
    console.log(`  ✓ Created: ${stats.created}`);
    console.log(`  ✓ Updated: ${stats.updated}`);
    console.log(`  ⚠️  Skipped: ${stats.skipped}`);
    console.log(`  ✗ Errors: ${stats.errors}`);
    console.log(`\nRoster Entries:`);
    console.log(`  ✓ Created: ${stats.rosterEntriesCreated}`);
    console.log(`  ⚠️  Skipped (already exists): ${stats.rosterEntriesSkipped}`);

    if (errors.length > 0) {
      console.log(`\n=== ERRORS ===\n`);
      errors.forEach((error, idx) => {
        console.log(`${idx + 1}. ${error}`);
      });
    } else {
      console.log('\n✓ All players processed successfully!');
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importPlayers();

