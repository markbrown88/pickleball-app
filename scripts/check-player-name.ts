import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkPlayerName(playerId: string) {
  try {
    console.log(`\n=== Checking Player: ${playerId} ===\n`);

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        gender: true,
        clubId: true,
        club: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
        clerkUserId: true,
      },
    });

    if (!player) {
      console.log(`❌ Player not found`);
      return;
    }

    console.log(`👤 PLAYER DATA:`);
    console.log(`   ID: ${player.id}`);
    console.log(`   Name: ${JSON.stringify(player.name)}`);
    console.log(`   First Name: ${JSON.stringify(player.firstName)}`);
    console.log(`   Last Name: ${JSON.stringify(player.lastName)}`);
    console.log(`   Email: ${player.email || 'None'}`);
    console.log(`   Gender: ${player.gender}`);
    console.log(`   Club: ${player.club?.name || 'None'} (ID: ${player.clubId})`);
    console.log(`   Clerk User ID: ${player.clerkUserId || 'None'}`);
    console.log(`   Created: ${player.createdAt.toISOString()}`);
    console.log(`   Updated: ${player.updatedAt.toISOString()}`);

    // Check what the name construction would produce
    const fn = (player.firstName ?? '').trim();
    const ln = (player.lastName ?? '').trim();
    const nameParts = [fn, ln].filter(Boolean);
    const constructedName = nameParts.join(' ') || player.name || 'Unknown';
    
    console.log(`\n📝 NAME CONSTRUCTION:`);
    console.log(`   firstName.trim(): "${fn}"`);
    console.log(`   lastName.trim(): "${ln}"`);
    console.log(`   nameParts: [${nameParts.map(p => `"${p}"`).join(', ')}]`);
    console.log(`   Final name: "${constructedName}"`);

    // Check if player is on any rosters
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: { playerId: player.id },
      include: {
        stop: {
          select: {
            id: true,
            name: true,
            tournament: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            bracket: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    console.log(`\n📋 ROSTER ENTRIES: ${rosterEntries.length}`);
    if (rosterEntries.length > 0) {
      rosterEntries.forEach((entry, idx) => {
        console.log(`   ${idx + 1}. ${entry.stop.tournament.name} - ${entry.stop.name} - ${entry.team.bracket.name} - ${entry.team.name}`);
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

const playerId = process.argv[2];
if (!playerId) {
  console.log('Usage: npx tsx scripts/check-player-name.ts <playerId>');
  process.exit(1);
}

checkPlayerName(playerId);

