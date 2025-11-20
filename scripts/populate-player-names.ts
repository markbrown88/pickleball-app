import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function populatePlayerNames() {
  try {
    console.log(`\n=== Populating null name fields ===\n`);

    // Find all players with null name
    const players = await prisma.player.findMany({
      where: {
        name: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
      },
    });

    console.log(`Found ${players.length} players with null name field\n`);

    if (players.length === 0) {
      console.log('No players found with null name.');
      await prisma.$disconnect();
      return;
    }

    let updated = 0;
    let skipped = 0;
    const updates: Array<{ id: string; email: string; oldName: string | null; newName: string }> = [];

    for (const player of players) {
      // Build name with proper fallback: firstName + lastName, then 'Unknown'
      const fn = (player.firstName ?? '').trim();
      const ln = (player.lastName ?? '').trim();
      const nameParts = [fn, ln].filter(Boolean);
      const newName = nameParts.join(' ') || 'Unknown';

      if (newName === 'Unknown') {
        console.log(`⚠️  Skipping ${player.email || player.id}: No name data available`);
        skipped++;
        continue;
      }

      // Update the player
      await prisma.player.update({
        where: { id: player.id },
        data: { name: newName },
      });

      updates.push({
        id: player.id,
        email: player.email || 'No email',
        oldName: player.name,
        newName,
      });

      updated++;
    }

    console.log(`\n✅ Updated ${updated} players`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} players (no name data)`);
    }

    if (updates.length > 0) {
      console.log(`\n📋 UPDATED PLAYERS:\n`);
      updates.forEach((update, idx) => {
        console.log(`${idx + 1}. ${update.email}`);
        console.log(`   ID: ${update.id}`);
        console.log(`   Old name: ${update.oldName || 'null'}`);
        console.log(`   New name: "${update.newName}"`);
        console.log('');
      });
    }

    // Verify the updates
    const remainingNull = await prisma.player.count({
      where: { name: null },
    });

    console.log(`\n📊 VERIFICATION:`);
    console.log(`   Players with null name remaining: ${remainingNull}`);
    if (remainingNull === skipped) {
      console.log(`   ✅ All players with name data have been updated`);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

populatePlayerNames();

