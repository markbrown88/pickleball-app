import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function verifyZainab() {
  try {
    const playerId = 'cmi8u80zo0001ju042vm9zpg8'; // The kept account

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        clerkUserId: true,
        club: { select: { name: true } },
      }
    });

    if (!player) {
      console.log('❌ Player not found!');
      return;
    }

    console.log('\n=== Zainab Account After Merge ===\n');
    console.log(`Name: ${player.name}`);
    console.log(`First Name: ${player.firstName}`);
    console.log(`Last Name: ${player.lastName}`);
    console.log(`Email: ${player.email}`);
    console.log(`Clerk ID: ${player.clerkUserId}`);
    console.log(`Club: ${player.club?.name || 'None'}`);

    // Check roster entries
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: { playerId: playerId },
      include: {
        stop: { select: { name: true } },
        team: { select: { name: true } }
      }
    });
    console.log(`\nRoster Entries: ${rosterEntries.length}`);
    rosterEntries.forEach((entry, i) => {
      console.log(`  ${i + 1}. ${entry.stop.name} - ${entry.team.name}`);
    });

    // Check lineup entries
    const lineupEntries = await prisma.lineupEntry.findMany({
      where: {
        OR: [
          { player1Id: playerId },
          { player2Id: playerId }
        ]
      }
    });
    console.log(`\nLineup Entries: ${lineupEntries.length}`);
    console.log(`  As Player 1: ${lineupEntries.filter(e => e.player1Id === playerId).length}`);
    console.log(`  As Player 2: ${lineupEntries.filter(e => e.player2Id === playerId).length}`);

    // Verify old account is deleted
    const oldPlayer = await prisma.player.findUnique({
      where: { id: 'cmg0683gm000brddchkrs3x9x' }
    });

    if (oldPlayer) {
      console.log('\n⚠️  Old player account still exists!');
    } else {
      console.log('\n✅ Old player account successfully deleted');
    }

    console.log('\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyZainab();

