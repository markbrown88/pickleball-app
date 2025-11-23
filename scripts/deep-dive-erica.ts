import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function deepDive() {
  const email = 'seeleyerica5@gmail.com';

  const registration = await prisma.tournamentRegistration.findFirst({
    where: { player: { email } },
    include: {
      player: true,
      tournament: true,
    },
    orderBy: { registeredAt: 'desc' },
  });

  if (!registration) {
    console.log('No registration found');
    return;
  }

  const notes = registration.notes ? JSON.parse(registration.notes) : {};

  console.log('\n=== TIMELINE ===');
  console.log('Registered:', registration.registeredAt);
  console.log('Payment completed:', notes.paidStops?.[0]?.paidAt || 'unknown');

  // Check the roster entry
  const rosterEntry = await prisma.stopTeamPlayer.findFirst({
    where: {
      playerId: registration.playerId,
      stopId: notes.stopIds?.[0],
    },
  });

  if (rosterEntry) {
    console.log('Roster entry created:', rosterEntry.createdAt);
    const timeDiff = new Date(rosterEntry.createdAt).getTime() - new Date(registration.registeredAt).getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    console.log(`Time gap: ${hoursDiff.toFixed(1)} hours`);
    console.log('\n⚠️  Roster was created MANUALLY (not immediately after payment)');
  }

  console.log('\n=== CHECKING WHAT WEBHOOK SHOULD HAVE DONE ===');

  const stopId = notes.stopIds?.[0];
  const bracketId = notes.brackets?.[0]?.bracketId;
  const clubId = notes.clubId;

  if (!stopId || !bracketId || !clubId) {
    console.log('❌ Missing required data in notes');
    await prisma.$disconnect();
    return;
  }

  // Check if bracket existed at payment time
  const bracket = await prisma.tournamentBracket.findUnique({
    where: { id: bracketId },
    select: { id: true, name: true, tournamentId: true },
  });

  if (!bracket) {
    console.log('\n❌ PROBLEM: Bracket does not exist!');
    console.log(`   Bracket ID: ${bracketId}`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n✅ Bracket exists: ${bracket.name} (${bracket.id})`);

  // Check if team existed or should have been created
  const team = await prisma.team.findFirst({
    where: {
      tournamentId: registration.tournamentId,
      clubId: clubId,
      bracketId: bracketId,
    },
  });

  if (team) {
    console.log(`✅ Team exists: ${team.name} (${team.id})`);
    console.log(`   Created: ${team.createdAt}`);

    // Check if team was created before or after payment
    const paymentTime = notes.paidStops?.[0]?.paidAt ? new Date(notes.paidStops[0].paidAt) : registration.registeredAt;
    if (new Date(team.createdAt) > paymentTime) {
      console.log('\n⚠️  Team was created AFTER payment - webhook might have tried to create it');
    } else {
      console.log('\n✅ Team existed before payment');
    }
  } else {
    console.log('\n❌ Team does NOT exist - webhook should have created it!');
  }

  // Try to simulate what the webhook would have done
  console.log('\n=== SIMULATING WEBHOOK LOGIC ===');

  const paidStopIds = notes.newlySelectedStopIds && notes.newlySelectedStopIds.length > 0
    ? notes.newlySelectedStopIds
    : notes.stopIds || [];

  const paidBrackets = (notes.brackets || []).filter((b: any) =>
    paidStopIds.includes(b.stopId)
  );

  console.log('paidStopIds:', paidStopIds);
  console.log('paidBrackets:', paidBrackets);
  console.log('clubId:', clubId);

  // Check if stop was in the past
  const stop = await prisma.stop.findUnique({
    where: { id: stopId },
    select: { name: true, startAt: true, endAt: true },
  });

  if (stop) {
    const paymentTime = notes.paidStops?.[0]?.paidAt ? new Date(notes.paidStops[0].paidAt) : new Date();
    const isPast = stop.endAt
      ? new Date(stop.endAt) < paymentTime
      : stop.startAt
        ? new Date(stop.startAt) < paymentTime
        : false;

    if (isPast) {
      console.log(`\n❌ PROBLEM: Stop "${stop.name}" was already past at payment time!`);
      console.log(`   Stop start: ${stop.startAt}`);
      console.log(`   Stop end: ${stop.endAt}`);
      console.log(`   Payment time: ${paymentTime}`);
      console.log('\n   The webhook skips roster creation for past stops (line 322-325 in route.ts)');
    } else {
      console.log(`\n✅ Stop was in the future at payment time`);
    }
  }

  // Check if there were any unique constraint violations
  if (team && rosterEntry) {
    console.log('\n=== CHECKING FOR CONSTRAINT ISSUES ===');
    console.log(`Roster entry exists for:`);
    console.log(`  stopId: ${rosterEntry.stopId}`);
    console.log(`  teamId: ${rosterEntry.teamId}`);
    console.log(`  playerId: ${rosterEntry.playerId}`);
    console.log(`This is the unique constraint: stopId_teamId_playerId`);
    console.log('\nNo constraint violation would have occurred.');
  }

  // Check payment intent matching
  console.log('\n=== PAYMENT TRACKING ===');
  console.log('Payment Intent from notes:', notes.paymentIntentId);
  console.log('Stripe Session ID:', notes.stripeSessionId);
  console.log('Payment Intent from registration.paymentId:', registration.paymentId);

  if (!registration.paymentId && !notes.paymentIntentId) {
    console.log('\n❌ PROBLEM: No payment intent ID recorded!');
    console.log('   This suggests the webhook may not have been called at all.');
  }

  await prisma.$disconnect();
}

deepDive();
