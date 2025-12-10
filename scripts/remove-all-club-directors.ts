import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function removeAllClubDirectors() {
  try {
    console.log('\n=== Removing All Club Directors ===\n');

    // First, count how many ClubDirector records exist
    const directorCount = await prisma.clubDirector.count();
    console.log(`Found ${directorCount} Club Director records to delete.`);

    // Count how many clubs have directorId set
    const clubsWithDirector = await prisma.club.count({
      where: { directorId: { not: null } }
    });
    console.log(`Found ${clubsWithDirector} clubs with directorId set.\n`);

    if (directorCount === 0 && clubsWithDirector === 0) {
      console.log('No Club Directors found. Nothing to delete.');
      await prisma.$disconnect();
      return;
    }

    // Delete all Club Directors from the ClubDirector table
    if (directorCount > 0) {
      const result = await prisma.clubDirector.deleteMany({});
      console.log(`✅ Successfully deleted ${result.count} Club Director record(s) from ClubDirector table.`);
    }

    // Clear directorId from all Club records
    if (clubsWithDirector > 0) {
      const clubResult = await prisma.club.updateMany({
        where: { directorId: { not: null } },
        data: { directorId: null }
      });
      console.log(`✅ Successfully cleared directorId from ${clubResult.count} club(s).\n`);
    }

    // Verify deletion
    const remainingDirectors = await prisma.clubDirector.count();
    const remainingClubsWithDirector = await prisma.club.count({
      where: { directorId: { not: null } }
    });

    if (remainingDirectors === 0 && remainingClubsWithDirector === 0) {
      console.log('✅ Verification: All Club Directors have been removed.');
    } else {
      if (remainingDirectors > 0) {
        console.log(`⚠️  Warning: ${remainingDirectors} Club Director record(s) still remain in ClubDirector table.`);
      }
      if (remainingClubsWithDirector > 0) {
        console.log(`⚠️  Warning: ${remainingClubsWithDirector} club(s) still have directorId set.`);
      }
    }

  } catch (error) {
    console.error('❌ Error removing Club Directors:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

removeAllClubDirectors();

