import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function findPlayersWithNullName() {
  try {
    console.log(`\n=== Finding Players with null name field ===\n`);

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
        gender: true,
        clubId: true,
        club: {
          select: {
            name: true,
          },
        },
        createdAt: true,
        clerkUserId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`Found ${players.length} players with null name field\n`);

    if (players.length === 0) {
      console.log('No players found with null name.');
      await prisma.$disconnect();
      return;
    }

    // Categorize players
    const withBothNames = players.filter(p => p.firstName && p.lastName);
    const withFirstNameOnly = players.filter(p => p.firstName && !p.lastName);
    const withLastNameOnly = players.filter(p => !p.firstName && p.lastName);
    const withNoNames = players.filter(p => !p.firstName && !p.lastName);

    console.log(`📊 BREAKDOWN:`);
    console.log(`   With both firstName and lastName: ${withBothNames.length}`);
    console.log(`   With firstName only: ${withFirstNameOnly.length}`);
    console.log(`   With lastName only: ${withLastNameOnly.length}`);
    console.log(`   With no names at all: ${withNoNames.length}\n`);

    console.log(`\n📋 ALL PLAYERS WITH NULL NAME:\n`);
    
    players.forEach((player, idx) => {
      const fn = (player.firstName ?? '').trim();
      const ln = (player.lastName ?? '').trim();
      const nameParts = [fn, ln].filter(Boolean);
      const constructedName = nameParts.join(' ') || 'Unknown';
      
      console.log(`${idx + 1}. ID: ${player.id}`);
      console.log(`   Email: ${player.email || 'None'}`);
      console.log(`   First Name: ${JSON.stringify(player.firstName)}`);
      console.log(`   Last Name: ${JSON.stringify(player.lastName)}`);
      console.log(`   Constructed Name: "${constructedName}"`);
      console.log(`   Gender: ${player.gender}`);
      console.log(`   Club: ${player.club?.name || 'None'}`);
      console.log(`   Clerk User ID: ${player.clerkUserId || 'None'}`);
      console.log(`   Created: ${player.createdAt.toISOString()}`);
      console.log('');
    });

    // Check if any of these players are on rosters
    console.log(`\n🔍 Checking roster entries for these players...\n`);
    
    const playerIds = players.map(p => p.id);
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: {
        playerId: { in: playerIds },
      },
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

    if (rosterEntries.length > 0) {
      console.log(`Found ${rosterEntries.length} roster entries for these players:\n`);
      const rosterByPlayer = new Map<string, typeof rosterEntries>();
      rosterEntries.forEach(entry => {
        if (!rosterByPlayer.has(entry.playerId)) {
          rosterByPlayer.set(entry.playerId, []);
        }
        rosterByPlayer.get(entry.playerId)!.push(entry);
      });

      rosterByPlayer.forEach((entries, playerId) => {
        const player = players.find(p => p.id === playerId);
        const fn = (player?.firstName ?? '').trim();
        const ln = (player?.lastName ?? '').trim();
        const nameParts = [fn, ln].filter(Boolean);
        const constructedName = nameParts.join(' ') || 'Unknown';
        console.log(`   ${constructedName} (${playerId}):`);
        entries.forEach(entry => {
          console.log(`      - ${entry.stop.tournament.name} - ${entry.stop.name} - ${entry.team.bracket.name} - ${entry.team.name}`);
        });
      });
    } else {
      console.log('No roster entries found for these players.');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

findPlayersWithNullName();

