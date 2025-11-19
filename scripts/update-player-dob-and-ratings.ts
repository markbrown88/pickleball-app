import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

const DEFAULT_CSV_PATH = 'C:/Users/markb/Downloads/klyng-cup-–-pickleplex-edition-player-registration-2025-11-18 - Sheet1.csv';

type CsvRow = {
  Email: string;
  'Date of Birth'?: string;
  'Gender (for team balance)'?: string;
  'Current DUPR Singles Rating'?: string;
  'Current DUPR Doubles Rating'?: string;
  'Current Club Singles Rating'?: string;
  'Current Club Doubles Rating'?: string;
};

function parseRating(value?: string): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function parseDate(value?: string): { birthday: Date; year: number; month: number; day: number; age: number } | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('-');
  if (parts.length !== 3) {
    console.warn(`Unable to parse DOB '${trimmed}'`);
    return null;
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!year || !month || !day) {
    console.warn(`Invalid DOB components '${trimmed}'`);
    return null;
  }

  const birthday = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(birthday.getTime())) {
    console.warn(`DOB produced invalid date '${trimmed}'`);
    return null;
  }

  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const hasHadBirthdayThisYear =
    today.getUTCMonth() + 1 > month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() >= day);
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  if (age < 0 || age > 120) {
    console.warn(`Calculated age ${age} out of range for DOB '${trimmed}'`);
    return null;
  }

  return { birthday, year, month, day, age };
}

async function main() {
  const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_CSV_PATH;
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  const fileContents = fs.readFileSync(csvPath, 'utf8');
  const rows = parse(fileContents, {
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];

  let updated = 0;
  let missingPlayers = 0;
  let totalRows = 0;

  for (const row of rows) {
    totalRows += 1;
    const email = row.Email?.trim().toLowerCase();
    if (!email) {
      console.warn(`Row ${totalRows}: missing email, skipping`);
      continue;
    }

    const player = await prisma.player.findUnique({
      where: { email },
    });

    if (!player) {
      console.warn(`No player found for email ${email}`);
      missingPlayers += 1;
      continue;
    }

    const dobInfo = parseDate(row['Date of Birth']);
    const duprSingles = parseRating(row['Current DUPR Singles Rating']);
    const duprDoubles = parseRating(row['Current DUPR Doubles Rating']);
    const clubSingles = parseRating(row['Current Club Singles Rating']);
    const clubDoubles = parseRating(row['Current Club Doubles Rating']);

    const data: Record<string, unknown> = {
      duprSingles,
      duprDoubles,
      clubRatingSingles: clubSingles,
      clubRatingDoubles: clubDoubles,
    };

    if (dobInfo) {
      data.birthday = dobInfo.birthday;
      data.birthdayYear = dobInfo.year;
      data.birthdayMonth = dobInfo.month;
      data.birthdayDay = dobInfo.day;
      data.age = dobInfo.age;
    }

    await prisma.player.update({
      where: { id: player.id },
      data,
    });

    updated += 1;
  }

  console.log(`Processed ${totalRows} rows. Updated ${updated} players. ${missingPlayers} players not found.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error updating players from CSV:', err);
  prisma.$disconnect();
  process.exit(1);
});
