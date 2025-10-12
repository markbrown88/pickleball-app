import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    // Check for duplicates
    const duplicates = await prisma.$queryRaw<Array<{ lineupId: string; slot: string; count: bigint }>>`
      SELECT "lineupId", slot, COUNT(*) as count
      FROM "LineupEntry"
      GROUP BY "lineupId", slot
      HAVING COUNT(*) > 1
    `;

    console.log('Found duplicate entries:');
    console.log(duplicates);

    if (duplicates.length > 0) {
      console.log('\nDeleting duplicates (keeping newest)...');

      // Delete duplicates, keeping the most recent one
      await prisma.$executeRaw`
        DELETE FROM "LineupEntry" a
        USING "LineupEntry" b
        WHERE a.id < b.id
          AND a."lineupId" = b."lineupId"
          AND a.slot = b.slot
      `;

      console.log('Duplicates removed successfully!');

      // Verify
      const remaining = await prisma.$queryRaw<Array<{ lineupId: string; slot: string; count: bigint }>>`
        SELECT "lineupId", slot, COUNT(*) as count
        FROM "LineupEntry"
        GROUP BY "lineupId", slot
        HAVING COUNT(*) > 1
      `;

      console.log('Remaining duplicates:', remaining.length);
    } else {
      console.log('No duplicates found!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();
