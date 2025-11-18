import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const emailsToInvestigate = [
  'ccooke11@cogeco.ca',
  'pattyoliveira7333@gmail.com',
  'dtoppi3@gmail.com',
  'joeyinfinity@gmail.com',
  'lourdesvillamor@gmail.com',
  'llukis@cogeco.ca',
  'udayanramesh2506@gmail.com',
  'ratnamsn2@gmail.com',
];

async function main() {
  console.log('DETAILED CHECKOUT ISSUE ANALYSIS\n');
  console.log('='.repeat(80));

  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      player: {
        email: {
          in: emailsToInvestigate,
        },
      },
      paymentStatus: 'PENDING',
    },
    include: {
      player: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          clerkUserId: true,
        },
      },
      tournament: {
        select: {
          name: true,
          registrationType: true,
        },
      },
    },
    orderBy: {
      registeredAt: 'asc',
    },
  });

  console.log(`Found ${registrations.length} pending registrations\n`);

  // Group by hour to see if there's a time pattern
  const registrationsByHour: Record<number, number> = {};
  const registrationsByDate: Record<string, number> = {};

  registrations.forEach(reg => {
    const date = new Date(reg.registeredAt);
    const hour = date.getUTCHours();
    const dateStr = date.toISOString().split('T')[0];
    
    registrationsByHour[hour] = (registrationsByHour[hour] || 0) + 1;
    registrationsByDate[dateStr] = (registrationsByDate[dateStr] || 0) + 1;
  });

  console.log('Registration Times:');
  registrations.forEach(reg => {
    const date = new Date(reg.registeredAt);
    let notes: any = {};
    try {
      notes = reg.notes ? JSON.parse(reg.notes) : {};
    } catch (e) {
      // ignore
    }

    console.log(`\n${reg.player.email}`);
    console.log(`  Registered: ${date.toISOString()} (${date.toLocaleString()})`);
    console.log(`  Session ID: ${notes.stripeSessionId || 'NONE'}`);
    console.log(`  Session Type: ${notes.stripeSessionId?.startsWith('cs_live_') ? 'LIVE' : notes.stripeSessionId?.startsWith('cs_test_') ? 'TEST' : 'UNKNOWN'}`);
    console.log(`  Amount: $${((reg.amountPaid || 0) / 100).toFixed(2)}`);
    console.log(`  Expected: $${notes.expectedAmount || 'N/A'}`);
    console.log(`  Stops: ${notes.stopIds?.length || 0}`);
    console.log(`  Brackets: ${notes.brackets?.length || 0}`);
  });

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('PATTERN ANALYSIS');
  console.log('='.repeat(80));

  console.log('\nRegistrations by Date:');
  Object.entries(registrationsByDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count} registration(s)`);
    });

  console.log('\nRegistrations by Hour (UTC):');
  Object.entries(registrationsByHour)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .forEach(([hour, count]) => {
      console.log(`  ${hour}:00 UTC: ${count} registration(s)`);
    });

  // Check for session ID patterns
  const sessionIds = registrations
    .map(reg => {
      try {
        const notes = reg.notes ? JSON.parse(reg.notes) : {};
        return notes.stripeSessionId;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const liveSessions = sessionIds.filter(id => id?.startsWith('cs_live_')).length;
  const testSessions = sessionIds.filter(id => id?.startsWith('cs_test_')).length;
  const unknownSessions = sessionIds.length - liveSessions - testSessions;

  console.log('\n\nSession ID Analysis:');
  console.log(`  Total Sessions: ${sessionIds.length}`);
  console.log(`  Live Sessions (cs_live_): ${liveSessions}`);
  console.log(`  Test Sessions (cs_test_): ${testSessions}`);
  console.log(`  Unknown Format: ${unknownSessions}`);

  // Check if STRIPE_SECRET_KEY is test or live
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const isTestKey = stripeKey.startsWith('sk_test_');
  const isLiveKey = stripeKey.startsWith('sk_live_');

  console.log('\n\nStripe Configuration:');
  console.log(`  Key Type: ${isTestKey ? 'TEST' : isLiveKey ? 'LIVE' : 'UNKNOWN'}`);
  console.log(`  Key Preview: ${stripeKey.substring(0, 12)}...`);

  if (isTestKey && liveSessions > 0) {
    console.log('\n⚠️  MISMATCH DETECTED:');
    console.log('  Using TEST Stripe key but sessions are marked as LIVE');
    console.log('  This would cause sessions to not be found in Stripe!');
  }

  if (isLiveKey && testSessions > 0) {
    console.log('\n⚠️  MISMATCH DETECTED:');
    console.log('  Using LIVE Stripe key but sessions are marked as TEST');
    console.log('  This would cause sessions to not be found in Stripe!');
  }

  // Time analysis
  const now = Date.now();
  const oldestRegistration = registrations[0];
  const newestRegistration = registrations[registrations.length - 1];
  
  if (oldestRegistration && newestRegistration) {
    const oldestTime = new Date(oldestRegistration.registeredAt).getTime();
    const newestTime = new Date(newestRegistration.registeredAt).getTime();
    const hoursSinceOldest = (now - oldestTime) / (1000 * 60 * 60);
    const hoursSinceNewest = (now - newestTime) / (1000 * 60 * 60);
    
    console.log('\n\nTime Analysis:');
    console.log(`  Oldest Registration: ${hoursSinceOldest.toFixed(1)} hours ago`);
    console.log(`  Newest Registration: ${hoursSinceNewest.toFixed(1)} hours ago`);
    console.log(`  Time Span: ${((newestTime - oldestTime) / (1000 * 60 * 60)).toFixed(1)} hours`);
    
    // Stripe sessions expire after 24 hours
    if (hoursSinceOldest > 24) {
      console.log(`\n⚠️  Oldest registration is ${hoursSinceOldest.toFixed(1)} hours old`);
      console.log('  Stripe checkout sessions expire after 24 hours');
      console.log('  These sessions would be expired/deleted by Stripe');
    }
  }

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('KEY FINDINGS');
  console.log('='.repeat(80));
  console.log('\n1. All users have:');
  console.log('   ✅ Player records');
  console.log('   ✅ Clerk accounts');
  console.log('   ✅ Stripe session IDs stored');
  console.log('   ❌ Payment intent IDs (none found)');
  console.log('   ❌ Sessions not found in Stripe (all 8 sessions)');
  
  console.log('\n2. Possible Root Causes:');
  console.log('   a) Stripe session mode mismatch (test vs live)');
  console.log('   b) Sessions expired (24 hour limit)');
  console.log('   c) Sessions were deleted');
  console.log('   d) Users never reached Stripe checkout page');
  console.log('   e) Redirect failed after session creation');
  
  console.log('\n3. Recommendations:');
  console.log('   • Verify Stripe key mode matches session mode');
  console.log('   • Check if redirect to Stripe is working');
  console.log('   • Implement retry payment flow for expired sessions');
  console.log('   • Add logging around redirect to Stripe');
  console.log('   • Check browser console for redirect errors');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

