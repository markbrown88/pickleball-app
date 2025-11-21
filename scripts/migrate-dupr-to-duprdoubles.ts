import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

/**
 * Migration script to copy `dupr` field values to `duprDoubles`
 * 
 * This should be run BEFORE removing the `dupr` field from the schema.
 */
async function migrateDuprToDuprDoubles() {
  try {
    console.log(`\n=== Migrating DUPR to DUPRDoubles ===\n`);

    // Find players with dupr but no duprDoubles
    const playersToMigrate = await prisma.player.findMany({
      where: {
        dupr: { not: null },
        duprDoubles: null
      },
      select: {
        id: true,
        name: true,
        email: true,
        dupr: true,
        duprDoubles: true,
        duprSingles: true
      }
    });

    console.log(`Found ${playersToMigrate.length} players with dupr but no duprDoubles\n`);

    if (playersToMigrate.length === 0) {
      console.log(`✅ No players need migration. Safe to proceed.\n`);
      return;
    }

    console.log(`📋 Sample players to migrate (first 10):`);
    playersToMigrate.slice(0, 10).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name || p.email || p.id}`);
      console.log(`      dupr: ${p.dupr} → will be copied to duprDoubles`);
    });
    if (playersToMigrate.length > 10) {
      console.log(`   ... and ${playersToMigrate.length - 10} more\n`);
    }

    // Migrate the data
    let migrated = 0;
    let skipped = 0;

    for (const player of playersToMigrate) {
      if (player.dupr === null) {
        skipped++;
        continue;
      }

      await prisma.player.update({
        where: { id: player.id },
        data: {
          duprDoubles: player.dupr
        }
      });

      migrated++;
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Migrated: ${migrated} players`);
    console.log(`   Skipped: ${skipped} players\n`);

    // Verify
    const remaining = await prisma.player.count({
      where: {
        dupr: { not: null },
        duprDoubles: null
      }
    });

    console.log(`📊 Verification:`);
    console.log(`   Players with dupr but no duprDoubles remaining: ${remaining}`);
    if (remaining === 0) {
      console.log(`   ✅ All players migrated successfully!\n`);
    } else {
      console.log(`   ⚠️  Some players still need migration\n`);
    }

  } catch (error) {
    console.error('Error migrating DUPR data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateDuprToDuprDoubles();

