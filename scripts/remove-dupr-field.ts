import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

/**
 * Migration script to remove the `dupr` field from the Player model
 * 
 * This script:
 * 1. Verifies that all players have duprDoubles populated (or null)
 * 2. Shows statistics about dupr vs duprDoubles usage
 * 3. Provides instructions for the Prisma migration
 * 
 * NOTE: This script does NOT actually remove the field from the database.
 * You must run: npx prisma migrate dev --name remove_dupr_field
 * after updating the schema.prisma file.
 */
async function analyzeDuprField() {
  try {
    console.log(`\n=== Analyzing DUPR Field Usage ===\n`);

    const totalPlayers = await prisma.player.count();
    console.log(`Total players in database: ${totalPlayers}\n`);

    // Count players with each DUPR field
    const playersWithDupr = await prisma.player.count({
      where: { dupr: { not: null } }
    });

    const playersWithDuprDoubles = await prisma.player.count({
      where: { duprDoubles: { not: null } }
    });

    const playersWithDuprSingles = await prisma.player.count({
      where: { duprSingles: { not: null } }
    });

    const playersWithDuprButNotDoubles = await prisma.player.count({
      where: {
        dupr: { not: null },
        duprDoubles: null
      }
    });

    console.log(`📊 DUPR FIELD STATISTICS:`);
    console.log(`   Players with dupr field: ${playersWithDupr}`);
    console.log(`   Players with duprDoubles field: ${playersWithDuprDoubles}`);
    console.log(`   Players with duprSingles field: ${playersWithDuprSingles}`);
    console.log(`   Players with dupr but NOT duprDoubles: ${playersWithDuprButNotDoubles}\n`);

    if (playersWithDuprButNotDoubles > 0) {
      console.log(`⚠️  WARNING: Found ${playersWithDuprButNotDoubles} players with dupr but no duprDoubles.`);
      console.log(`   These players will lose their DUPR data when the field is removed.\n`);

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
        },
        take: 10
      });

      console.log(`   Sample players that need migration:`);
      playersToMigrate.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name || p.email || p.id}`);
        console.log(`      dupr: ${p.dupr}, duprDoubles: ${p.duprDoubles}, duprSingles: ${p.duprSingles}`);
      });
      if (playersWithDuprButNotDoubles > 10) {
        console.log(`   ... and ${playersWithDuprButNotDoubles - 10} more\n`);
      }
    } else {
      console.log(`✅ All players with dupr also have duprDoubles. Safe to remove dupr field.\n`);
    }

    // Check for discrepancies
    const playersWithDifferentValues = await prisma.player.count({
      where: {
        dupr: { not: null },
        duprDoubles: { not: null },
        NOT: {
          dupr: { equals: prisma.player.fields.duprDoubles }
        }
      }
    });

    if (playersWithDifferentValues > 0) {
      console.log(`⚠️  WARNING: Found ${playersWithDifferentValues} players where dupr ≠ duprDoubles.`);
      console.log(`   The code now uses duprDoubles, so these differences will be visible.\n`);
    }

    console.log(`\n📋 NEXT STEPS:`);
    console.log(`   1. Review the statistics above`);
    console.log(`   2. If playersWithDuprButNotDoubles > 0, consider migrating data:`);
    console.log(`      UPDATE "Player" SET "duprDoubles" = "dupr" WHERE "dupr" IS NOT NULL AND "duprDoubles" IS NULL;`);
    console.log(`   3. Update prisma/schema.prisma to remove: dupr Float?`);
    console.log(`   4. Run: npx prisma migrate dev --name remove_dupr_field`);
    console.log(`   5. After migration, remove all code references to player.dupr\n`);

  } catch (error) {
    console.error('Error analyzing DUPR field:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeDuprField();

