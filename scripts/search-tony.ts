import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function searchTony() {
  try {
    console.log('\n=== Searching for players named Tony ===\n');

    // Search by firstName
    const playersByFirstName = await prisma.player.findMany({
      where: {
        OR: [
          { firstName: { contains: 'tony', mode: 'insensitive' } },
          { lastName: { contains: 'tony', mode: 'insensitive' } },
          { name: { contains: 'tony', mode: 'insensitive' } },
          { email: { contains: 'tony', mode: 'insensitive' } },
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`Found ${playersByFirstName.length} player(s) matching "tony":\n`);

    if (playersByFirstName.length === 0) {
      console.log('No players found with "tony" in their name or email.');
    } else {
      playersByFirstName.forEach((player, i) => {
        console.log(`${i + 1}. ${player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unknown'}`);
        console.log(`   ID: ${player.id}`);
        console.log(`   Email: ${player.email || 'None'}`);
        console.log(`   First Name: ${player.firstName || 'None'}`);
        console.log(`   Last Name: ${player.lastName || 'None'}`);
        console.log(`   Gender: ${player.gender}`);
        console.log(`   Club: ${player.club?.name || 'None'}`);
        console.log(`   Clerk User ID: ${player.clerkUserId || 'None'}`);
        console.log(`   Created: ${player.createdAt.toISOString()}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('Error searching for Tony:', error);
  } finally {
    await prisma.$disconnect();
  }
}

searchTony();

