import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkConditions() {
  const email = 'seeleyerica5@gmail.com';

  const registration = await prisma.tournamentRegistration.findFirst({
    where: {
      player: { email },
    },
    include: {
      player: {
        include: { club: true },
      },
      tournament: {
        include: {
          brackets: true,
        },
      },
    },
    orderBy: { registeredAt: 'desc' },
  });

  if (!registration) {
    console.log('No registration found');
    return;
  }

  console.log('\n=== DIAGNOSTIC REPORT ===\n');

  console.log('Tournament Type:', registration.tournament.type);
  console.log('Player Club ID:', registration.player.clubId);
  console.log('Player Club Name:', registration.player.club.name);

  const notes = registration.notes ? JSON.parse(registration.notes) : {};
  console.log('\nRegistration Notes Club ID:', notes.clubId);
  console.log('Stop IDs:', notes.stopIds);
  console.log('Brackets:', notes.brackets);

  console.log('\n=== CLUB ID COMPARISON ===');
  console.log('Player clubId:', registration.player.clubId);
  console.log('Registration notes clubId:', notes.clubId);
  console.log('MATCH:', registration.player.clubId === notes.clubId ? '✅ YES' : '❌ NO - THIS IS THE PROBLEM!');

  if (registration.player.clubId !== notes.clubId) {
    const regClub = await prisma.club.findUnique({
      where: { id: notes.clubId },
    });
    console.log('\nPlayer is in club:', registration.player.club.name);
    console.log('But registered for club:', regClub?.name || 'Unknown');
    console.log('\n⚠️  ROOT CAUSE: Player clubId mismatch!');
    console.log('The webhook tries to create roster entries, but the player is not a member');
    console.log('of the club they registered for, which may cause the roster creation to fail.');
  }

  await prisma.$disconnect();
}

checkConditions();
