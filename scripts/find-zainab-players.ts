import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function findZainabPlayers() {
  try {
    console.log(`\n=== Finding Players with First Name "Zainab" ===\n`);

    const players = await prisma.player.findMany({
      where: {
        firstName: {
          equals: 'Zainab',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        clerkUserId: true,
        club: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${players.length} player(s) with first name "Zainab":\n`);

    if (players.length === 0) {
      console.log(`No players found with first name "Zainab".\n`);
      return;
    }

    players.forEach((player, i) => {
      console.log(`${i + 1}. ID: ${player.id}`);
      console.log(`   Name: ${player.name || `${player.firstName} ${player.lastName}`}`);
      console.log(`   First Name: "${player.firstName || 'null'}"`);
      console.log(`   Last Name: "${player.lastName || 'null'}"`);
      console.log(`   Email: ${player.email || 'None'}`);
      console.log(`   Clerk User ID: ${player.clerkUserId || 'None'}`);
      console.log(`   Club: ${player.club?.name || 'None'}`);
      console.log(`   Created: ${player.createdAt.toISOString()}\n`);
    });

    // Check for any relationships
    console.log(`\n📋 Checking for relationships...\n`);
    
    for (const player of players) {
      const rosterEntries = await prisma.stopTeamPlayer.count({
        where: { playerId: player.id }
      });
      
      const lineupEntriesP1 = await prisma.lineupEntry.count({
        where: { player1Id: player.id }
      });
      
      const lineupEntriesP2 = await prisma.lineupEntry.count({
        where: { player2Id: player.id }
      });
      
      const registrations = await prisma.tournamentRegistration.count({
        where: { playerId: player.id }
      });
      
      const teamMemberships = await prisma.teamPlayer.count({
        where: { playerId: player.id }
      });

      console.log(`Player: ${player.name || `${player.firstName} ${player.lastName}`} (${player.id})`);
      console.log(`   Roster Entries: ${rosterEntries}`);
      console.log(`   Lineup Entries (P1): ${lineupEntriesP1}`);
      console.log(`   Lineup Entries (P2): ${lineupEntriesP2}`);
      console.log(`   Registrations: ${registrations}`);
      console.log(`   Team Memberships: ${teamMemberships}\n`);
    }

  } catch (error) {
    console.error('Error finding Zainab players:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findZainabPlayers();

