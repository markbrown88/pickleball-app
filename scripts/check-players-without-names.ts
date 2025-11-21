import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkPlayersWithoutNames() {
  try {
    console.log('\n=== Checking for Players without Name Fields ===\n');

    // Find players with null or empty name
    const playersWithoutName = await prisma.player.findMany({
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
        gender: true,
        club: { select: { name: true } },
        clerkUserId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`Total players in database: ${await prisma.player.count()}`);
    console.log(`Found ${playersWithoutName.length} player(s) without name field\n`);

    if (playersWithoutName.length === 0) {
      console.log('✅ All players have name fields populated!\n');
    } else {
      console.log('📋 PLAYERS WITHOUT NAME FIELD:\n');
      
      let withBothNames = 0;
      let withFirstNameOnly = 0;
      let withLastNameOnly = 0;
      let withNoNames = 0;

      for (const player of playersWithoutName) {
        const fn = (player.firstName ?? '').trim();
        const ln = (player.lastName ?? '').trim();
        const hasFirstName = Boolean(fn);
        const hasLastName = Boolean(ln);

        if (hasFirstName && hasLastName) {
          withBothNames++;
        } else if (hasFirstName) {
          withFirstNameOnly++;
        } else if (hasLastName) {
          withLastNameOnly++;
        } else {
          withNoNames++;
        }

        const constructedName = [fn, ln].filter(Boolean).join(' ') || 'Unknown';

        console.log(`ID: ${player.id}`);
        console.log(`   Email: ${player.email || 'None'}`);
        console.log(`   First Name: ${player.firstName === null ? 'null' : `"${player.firstName}"`}`);
        console.log(`   Last Name: ${player.lastName === null ? 'null' : `"${player.lastName}"`}`);
        console.log(`   Name: ${player.name === null ? 'null' : `"${player.name}"`}`);
        console.log(`   Constructed Name: "${constructedName}"`);
        console.log(`   Gender: ${player.gender}`);
        console.log(`   Club: ${player.club?.name || 'None'}`);
        console.log(`   Clerk User ID: ${player.clerkUserId || 'None'}`);
        console.log(`   Created: ${player.createdAt.toISOString()}`);
        console.log(`   Updated: ${player.updatedAt.toISOString()}`);
        console.log('');
      }

      console.log('\n📊 BREAKDOWN:');
      console.log(`   With both firstName and lastName: ${withBothNames}`);
      console.log(`   With firstName only: ${withFirstNameOnly}`);
      console.log(`   With lastName only: ${withLastNameOnly}`);
      console.log(`   With no names at all: ${withNoNames}\n`);

      // Check for roster entries
      const playersWithRosterEntries: Record<string, number> = {};
      for (const player of playersWithoutName) {
        const rosterCount = await prisma.stopTeamPlayer.count({
          where: { playerId: player.id },
        });

        if (rosterCount > 0) {
          playersWithRosterEntries[player.id] = rosterCount;
        }
      }

      const rosteredPlayerIds = Object.keys(playersWithRosterEntries);
      if (rosteredPlayerIds.length > 0) {
        console.log(`\n🔍 ${rosteredPlayerIds.length} of these players have roster entries:\n`);
        rosteredPlayerIds.forEach(playerId => {
          const player = playersWithoutName.find(p => p.id === playerId);
          if (player) {
            const fn = (player.firstName ?? '').trim();
            const ln = (player.lastName ?? '').trim();
            const constructedName = [fn, ln].filter(Boolean).join(' ') || 'Unknown';
            console.log(`   ${constructedName} (${player.id}): ${playersWithRosterEntries[playerId]} roster entry/ies`);
          }
        });
      } else {
        console.log('\n✅ None of these players have roster entries.');
      }
    }

  } catch (error) {
    console.error('Error checking players without names:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPlayersWithoutNames();

