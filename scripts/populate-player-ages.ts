import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

function computeAge(y?: number | null, m?: number | null, d?: number | null): number | null {
  if (!y || !m || !d) return null;
  try {
    const today = new Date();
    let age = today.getFullYear() - y;
    const mm = m - 1;
    if (today.getMonth() < mm || (today.getMonth() === mm && today.getDate() < d)) age -= 1;
    return age;
  } catch {
    return null;
  }
}

async function populatePlayerAges() {
  try {
    console.log(`\n=== Populating Player Ages ===\n`);

    // Find all players with birthday data
    const players = await prisma.player.findMany({
      where: {
        birthdayYear: { not: null },
        birthdayMonth: { not: null },
        birthdayDay: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        birthdayYear: true,
        birthdayMonth: true,
        birthdayDay: true,
        age: true,
      },
    });

    console.log(`Found ${players.length} players with birthday data\n`);

    const updatedPlayers = [];
    const skippedPlayers = [];
    const alreadyCorrect = [];

    for (const player of players) {
      const calculatedAge = computeAge(player.birthdayYear, player.birthdayMonth, player.birthdayDay);

      if (calculatedAge === null) {
        skippedPlayers.push(player);
        continue;
      }

      // Check if age is already correct
      if (player.age === calculatedAge) {
        alreadyCorrect.push(player);
        continue;
      }

      // Update the player's age
      await prisma.player.update({
        where: { id: player.id },
        data: { age: calculatedAge },
      });

      updatedPlayers.push({
        ...player,
        oldAge: player.age,
        newAge: calculatedAge,
      });

      console.log(
        `✅ Updated: ${player.name || `${player.firstName} ${player.lastName}`} (${player.email || player.id}) - Age: ${player.age ?? 'null'} → ${calculatedAge}`
      );
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Updated: ${updatedPlayers.length} players`);
    console.log(`   ✓ Already correct: ${alreadyCorrect.length} players`);
    console.log(`   ⚠️  Skipped: ${skippedPlayers.length} players (could not calculate age)\n`);

    if (skippedPlayers.length > 0) {
      console.log(`📋 SKIPPED PLAYERS:`);
      skippedPlayers.forEach((player, i) => {
        console.log(`   ${i + 1}. ${player.name || `${player.firstName} ${player.lastName}`} (${player.email || player.id})`);
        console.log(`      Birthday: ${player.birthdayYear}/${player.birthdayMonth}/${player.birthdayDay}\n`);
      });
    }

    // Verify
    const playersWithNullAge = await prisma.player.count({
      where: {
        birthdayYear: { not: null },
        birthdayMonth: { not: null },
        birthdayDay: { not: null },
        age: null,
      },
    });

    console.log(`\n📊 VERIFICATION:`);
    console.log(`   Players with birthday but null age remaining: ${playersWithNullAge}`);
    if (playersWithNullAge === 0) {
      console.log(`   ✅ All players with birthday data now have age calculated`);
    } else {
      console.log(`   ⚠️  Some players still have null age (likely calculation issues)`);
    }

  } catch (error) {
    console.error('Error populating player ages:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populatePlayerAges();

