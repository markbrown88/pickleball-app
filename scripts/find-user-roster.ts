import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function findUserRoster(email: string) {
  try {
    // Find the player by email
    const player = await prisma.player.findUnique({
      where: { email },
      include: {
        club: true,
      },
    });

    if (!player) {
      console.log(`\n❌ No player found with email: ${email}`);
      return;
    }

    console.log('\n=== Player Info ===');
    console.log(`Name: ${player.firstName} ${player.lastName}`);
    console.log(`Email: ${player.email}`);
    console.log(`Gender: ${player.gender}`);
    console.log(`Club: ${player.club.name}`);
    console.log(`Player ID: ${player.id}`);

    // Find all roster entries for this player
    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: {
        playerId: player.id,
      },
      include: {
        stop: {
          include: {
            tournament: true,
            club: true,
          },
        },
        team: {
          include: {
            bracket: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (rosterEntries.length === 0) {
      console.log('\n❌ This player is not on any roster');
      return;
    }

    console.log(`\n=== Roster Entries (${rosterEntries.length}) ===\n`);

    for (const entry of rosterEntries) {
      console.log(`Tournament: ${entry.stop.tournament.name}`);
      console.log(`Stop: ${entry.stop.name} (${entry.stop.id})`);
      console.log(`Team: ${entry.team.name} (${entry.team.id})`);
      if (entry.team.bracket) {
        console.log(`Bracket: ${entry.team.bracket.name}`);
      }
      console.log(`Payment Method: ${entry.paymentMethod}`);
      console.log(`Added to Roster: ${entry.createdAt.toISOString()}`);
      console.log('---');
    }

    // Also check for tournament registrations
    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        playerId: player.id,
      },
      include: {
        tournament: true,
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    if (registrations.length > 0) {
      console.log(`\n=== Tournament Registrations (${registrations.length}) ===\n`);
      for (const reg of registrations) {
        console.log(`Tournament: ${reg.tournament.name}`);
        console.log(`Status: ${reg.status}`);
        console.log(`Payment Status: ${reg.paymentStatus}`);
        console.log(`Registered: ${reg.registeredAt.toISOString()}`);
        if (reg.notes) {
          console.log(`Notes: ${reg.notes}`);
        }
        console.log('---');
      }
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2] || 'seeleyerica5@gmail.com';
findUserRoster(email)
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
