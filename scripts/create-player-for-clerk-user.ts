/**
 * Script to manually create a Player record for a Clerk user
 * 
 * Usage:
 *   npx tsx scripts/create-player-for-clerk-user.ts <email> [clerkUserId]
 * 
 * Example:
 *   npx tsx scripts/create-player-for-clerk-user.ts lily@lilyfairjewelry.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createPlayerForClerkUser(email: string, clerkUserId?: string) {
  try {
    console.log(`\nCreating Player record for: ${email}`);
    if (clerkUserId) {
      console.log(`Clerk User ID: ${clerkUserId}`);
    }

    // Check if player already exists
    const existingByEmail = await prisma.player.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingByEmail) {
      console.log(`\n✓ Player already exists with email ${email}:`);
      console.log(`  ID: ${existingByEmail.id}`);
      console.log(`  Name: ${existingByEmail.name || 'N/A'}`);
      console.log(`  Clerk User ID: ${existingByEmail.clerkUserId || 'Not linked'}`);
      
      if (clerkUserId && !existingByEmail.clerkUserId) {
        console.log(`\n  Linking Clerk account...`);
        const updated = await prisma.player.update({
          where: { id: existingByEmail.id },
          data: { clerkUserId },
        });
        console.log(`  ✓ Successfully linked Clerk account`);
        return updated;
      }
      
      return existingByEmail;
    }

    if (clerkUserId) {
      const existingByClerkId = await prisma.player.findUnique({
        where: { clerkUserId },
      });

      if (existingByClerkId) {
        console.log(`\n✓ Player already exists with Clerk User ID ${clerkUserId}:`);
        console.log(`  ID: ${existingByClerkId.id}`);
        console.log(`  Email: ${existingByClerkId.email || 'N/A'}`);
        return existingByClerkId;
      }
    }

    // Find a default club
    const defaultClub = await prisma.club.findFirst({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    if (!defaultClub) {
      throw new Error('No clubs found in database. Cannot create Player without a club.');
    }

    console.log(`\nUsing default club: ${defaultClub.name} (${defaultClub.id})`);

    // Extract name from email if possible
    const emailParts = email.split('@')[0].split('.');
    const firstName = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : null;
    const lastName = emailParts[1] ? emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1) : null;
    const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || null;

    // Create the player
    const player = await prisma.player.create({
      data: {
        clerkUserId: clerkUserId || null,
        email: email.toLowerCase(),
        firstName,
        lastName,
        name,
        gender: 'MALE', // Default
        country: 'Canada',
        clubId: defaultClub.id,
      },
    });

    console.log(`\n✓ Successfully created Player record:`);
    console.log(`  ID: ${player.id}`);
    console.log(`  Email: ${player.email}`);
    console.log(`  Name: ${player.name || 'N/A'}`);
    console.log(`  Clerk User ID: ${player.clerkUserId || 'Not linked'}`);
    console.log(`  Club: ${defaultClub.name}`);

    return player;
  } catch (error: any) {
    console.error('\n✗ Error creating Player:', error.message);
    if (error.code === 'P2002') {
      console.error('  This email or Clerk User ID already exists.');
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const email = args[0];
const clerkUserId = args[1];

if (!email) {
  console.error('Usage: npx tsx scripts/create-player-for-clerk-user.ts <email> [clerkUserId]');
  console.error('Example: npx tsx scripts/create-player-for-clerk-user.ts lily@lilyfairjewelry.com');
  process.exit(1);
}

createPlayerForClerkUser(email, clerkUserId)
  .then(() => {
    console.log('\n✓ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Failed:', error);
    process.exit(1);
  });

