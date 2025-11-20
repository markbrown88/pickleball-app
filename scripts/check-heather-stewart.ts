import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkHeatherStewart() {
  try {
    console.log('Searching for Heather Stewart...\n');

    // Search by name
    const playersByName = await prisma.player.findMany({
      where: {
        OR: [
          { firstName: { contains: 'Heather', mode: 'insensitive' } },
          { lastName: { contains: 'Stewart', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        disabled: true,
        disabledAt: true,
      },
    });

    console.log(`Found ${playersByName.length} player(s) with name matching Heather Stewart:`);
    playersByName.forEach(p => {
      console.log(`  - ${p.firstName} ${p.lastName} (${p.email || 'No email'})`);
      console.log(`    ID: ${p.id}`);
      console.log(`    Disabled: ${p.disabled}${p.disabledAt ? ` (at ${p.disabledAt})` : ''}`);
    });

    // Check lineup entries for Vaughn stop
    const vaughnStopId = 'cmh7rtx2x000hl804yn12dfw9';
    
    console.log('\nChecking lineup entries for Vaughn stop...');
    const lineupEntries = await prisma.lineupEntry.findMany({
      where: {
        OR: [
          { player1: { firstName: { contains: 'Heather', mode: 'insensitive' }, lastName: { contains: 'Stewart', mode: 'insensitive' } } },
          { player2: { firstName: { contains: 'Heather', mode: 'insensitive' }, lastName: { contains: 'Stewart', mode: 'insensitive' } } },
        ],
        lineup: {
          stopId: vaughnStopId,
        },
      },
      include: {
        player1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            disabled: true,
          },
        },
        player2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            disabled: true,
          },
        },
        lineup: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    console.log(`\nFound ${lineupEntries.length} lineup entry(ies) for Heather Stewart:`);
    lineupEntries.forEach((entry, idx) => {
      const isPlayer1 = entry.player1.firstName?.toLowerCase().includes('heather') && entry.player1.lastName?.toLowerCase().includes('stewart');
      const player = isPlayer1 ? entry.player1 : entry.player2;
      console.log(`\n  Entry ${idx + 1}:`);
      console.log(`    Player ID: ${player.id}`);
      console.log(`    Name: ${player.firstName} ${player.lastName}`);
      console.log(`    Email: ${player.email || 'No email'}`);
      console.log(`    Disabled: ${player.disabled}`);
      console.log(`    Team: ${entry.lineup.team.name}`);
      console.log(`    Slot: ${entry.slot}`);
    });

    // Check if any of these player IDs exist in the roster
    if (lineupEntries.length > 0) {
      const playerIds = lineupEntries.map(e => {
        const isPlayer1 = e.player1.firstName?.toLowerCase().includes('heather') && e.player1.lastName?.toLowerCase().includes('stewart');
        return isPlayer1 ? e.player1.id : e.player2.id;
      });

      console.log('\nChecking roster entries...');
      const rosterEntries = await prisma.stopTeamPlayer.findMany({
        where: {
          stopId: vaughnStopId,
          playerId: { in: playerIds },
        },
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (rosterEntries.length > 0) {
        console.log(`Found ${rosterEntries.length} roster entry(ies):`);
        rosterEntries.forEach(re => {
          console.log(`  - ${re.player.firstName} ${re.player.lastName} (${re.paymentMethod})`);
        });
      } else {
        console.log('No roster entries found for these player IDs');
      }
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkHeatherStewart()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

