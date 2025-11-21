import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function populateMissingPlayerNames() {
  try {
    console.log('\n=== Populating Missing Player Names ===\n');

    // Find players with null or empty name
    const playersToUpdate = await prisma.player.findMany({
      where: {
        OR: [
          { name: null },
          { name: '' },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
      },
    });

    console.log(`Found ${playersToUpdate.length} players without name field\n`);

    if (playersToUpdate.length === 0) {
      console.log('✅ All players already have name fields populated!\n');
      return;
    }

    const updatedPlayers = [];
    const skippedPlayers = [];

    for (const player of playersToUpdate) {
      const fn = (player.firstName ?? '').trim();
      const ln = (player.lastName ?? '').trim();
      const newName = [fn, ln].filter(Boolean).join(' ');

      if (newName) {
        await prisma.player.update({
          where: { id: player.id },
          data: { name: newName },
        });
        updatedPlayers.push({ ...player, newName });
        console.log(`✅ Updated: ${newName} (${player.email || player.id})`);
      } else {
        skippedPlayers.push(player);
        console.log(`⚠️  Skipped: ${player.email || player.id} (no firstName/lastName)`);
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Updated: ${updatedPlayers.length} players`);
    console.log(`   ⚠️  Skipped: ${skippedPlayers.length} players (no name data)`);

    // Verify
    const remainingNullNames = await prisma.player.count({
      where: {
        OR: [
          { name: null },
          { name: '' },
        ],
      },
    });
    console.log(`\n📊 VERIFICATION:`);
    console.log(`   Players with null/empty name remaining: ${remainingNullNames}`);
    if (remainingNullNames === 0) {
      console.log(`   ✅ All players with name data have been updated`);
    } else {
      console.log(`   ⚠️  Some players still have null names (likely no firstName/lastName)`);
    }

  } catch (error) {
    console.error('Error populating player names:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populateMissingPlayerNames();

