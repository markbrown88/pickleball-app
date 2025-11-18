import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
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

interface UserInvestigation {
  email: string;
  hasPlayerRecord: boolean;
  hasClerkAccount: boolean;
  clerkUserId: string | null;
  playerId: string | null;
  registrations: Array<{
    id: string;
    tournamentId: string;
    tournamentName: string;
    status: string;
    paymentStatus: string;
    amountPaid: number | null;
    registeredAt: Date;
    notes: any;
    stripeSessionId?: string;
    paymentIntentId?: string;
  }>;
  accountCreationMethod?: string; // 'SSO', 'EMAIL', 'MANUAL', 'UNKNOWN'
  hasPendingPayments: boolean;
  hasFailedPayments: boolean;
  issues: string[];
}

async function investigateUser(email: string): Promise<UserInvestigation> {
  const issues: string[] = [];
  const result: UserInvestigation = {
    email,
    hasPlayerRecord: false,
    hasClerkAccount: false,
    clerkUserId: null,
    playerId: null,
    registrations: [],
    hasPendingPayments: false,
    hasFailedPayments: false,
    issues: [],
  };

  // Find player record
  const player = await prisma.player.findUnique({
    where: { email },
    select: {
      id: true,
      clerkUserId: true,
      firstName: true,
      lastName: true,
      email: true,
      createdAt: true,
    },
  });

  if (player) {
    result.hasPlayerRecord = true;
    result.playerId = player.id;
    result.clerkUserId = player.clerkUserId;
    result.hasClerkAccount = !!player.clerkUserId;

    // Determine account creation method
    if (player.clerkUserId) {
      // Check if Clerk user exists (we can't directly query Clerk, but we can infer)
      // If clerkUserId exists, they likely used SSO or email/password through Clerk
      result.accountCreationMethod = 'SSO_OR_EMAIL'; // We can't distinguish without Clerk API
    } else {
      result.accountCreationMethod = 'MANUAL';
      issues.push('Player record exists but no Clerk account linked');
    }
  } else {
    issues.push('No Player record found for this email');
  }

  // Find all registrations for this player
  if (result.playerId) {
    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        playerId: result.playerId,
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            registrationType: true,
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    for (const reg of registrations) {
      let notes: any = {};
      if (reg.notes) {
        try {
          notes = JSON.parse(reg.notes);
        } catch (e) {
          issues.push(`Failed to parse notes for registration ${reg.id}`);
        }
      }

      const registrationData = {
        id: reg.id,
        tournamentId: reg.tournamentId,
        tournamentName: reg.tournament.name,
        status: reg.status,
        paymentStatus: reg.paymentStatus,
        amountPaid: reg.amountPaid,
        registeredAt: reg.registeredAt,
        notes,
        stripeSessionId: notes.stripeSessionId,
        paymentIntentId: notes.paymentIntentId,
      };

      result.registrations.push(registrationData);

      // Check for payment issues
      if (reg.paymentStatus === 'PENDING' && reg.tournament.registrationType === 'PAID') {
        result.hasPendingPayments = true;
        if (!notes.stripeSessionId) {
          issues.push(`Registration ${reg.id} has PENDING payment but no Stripe session ID`);
        }
      }

      if (reg.paymentStatus === 'FAILED') {
        result.hasFailedPayments = true;
        issues.push(`Registration ${reg.id} has FAILED payment status`);
      }

      // Check for common issues
      if (reg.status === 'REGISTERED' && reg.paymentStatus === 'PENDING' && reg.tournament.registrationType === 'PAID') {
        const hoursSinceRegistration = (Date.now() - reg.registeredAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceRegistration > 24) {
          issues.push(`Registration ${reg.id} has been pending for ${Math.round(hoursSinceRegistration)} hours`);
        }
      }

      // Check if notes have stopIds/brackets
      if (!notes.stopIds || notes.stopIds.length === 0) {
        issues.push(`Registration ${reg.id} has no stopIds in notes`);
      }

      if (!notes.brackets || notes.brackets.length === 0) {
        issues.push(`Registration ${reg.id} has no brackets in notes`);
      }

      // Check amount consistency
      if (reg.tournament.registrationType === 'PAID') {
        if (reg.amountPaid === null || reg.amountPaid === 0) {
          if (notes.expectedAmount) {
            issues.push(`Registration ${reg.id} has expected amount ${notes.expectedAmount} but amountPaid is ${reg.amountPaid}`);
          }
        }
      }
    }
  } else {
    // Check if there are any registrations by email (shouldn't happen, but check)
    const registrationsByEmail = await prisma.tournamentRegistration.findMany({
      where: {
        player: {
          email,
        },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            registrationType: true,
          },
        },
      },
    });

    if (registrationsByEmail.length > 0) {
      issues.push(`Found ${registrationsByEmail.length} registrations but no player record`);
    }
  }

  result.issues = issues;
  return result;
}

async function main() {
  console.log('Investigating checkout issues for users...\n');
  console.log('='.repeat(80));

  const results: UserInvestigation[] = [];

  for (const email of emailsToInvestigate) {
    console.log(`\nInvestigating: ${email}`);
    console.log('-'.repeat(80));
    const investigation = await investigateUser(email);
    results.push(investigation);

    console.log(`Player Record: ${investigation.hasPlayerRecord ? 'YES' : 'NO'}`);
    console.log(`Clerk Account: ${investigation.hasClerkAccount ? 'YES' : 'NO'}`);
    console.log(`Clerk User ID: ${investigation.clerkUserId || 'N/A'}`);
    console.log(`Account Creation Method: ${investigation.accountCreationMethod || 'UNKNOWN'}`);
    console.log(`Registrations: ${investigation.registrations.length}`);

    if (investigation.registrations.length > 0) {
      console.log('\nRegistration Details:');
      investigation.registrations.forEach((reg, idx) => {
        console.log(`\n  Registration ${idx + 1}:`);
        console.log(`    ID: ${reg.id}`);
        console.log(`    Tournament: ${reg.tournamentName}`);
        console.log(`    Status: ${reg.status}`);
        console.log(`    Payment Status: ${reg.paymentStatus}`);
        console.log(`    Amount Paid: ${reg.amountPaid ? `$${(reg.amountPaid / 100).toFixed(2)}` : '$0.00'}`);
        console.log(`    Registered At: ${reg.registeredAt.toISOString()}`);
        console.log(`    Stripe Session ID: ${reg.stripeSessionId || 'NONE'}`);
        console.log(`    Payment Intent ID: ${reg.paymentIntentId || 'NONE'}`);
        
        if (reg.notes.stopIds) {
          console.log(`    Stop IDs: ${JSON.stringify(reg.notes.stopIds)}`);
        }
        if (reg.notes.brackets) {
          console.log(`    Brackets: ${JSON.stringify(reg.notes.brackets)}`);
        }
        if (reg.notes.expectedAmount) {
          console.log(`    Expected Amount: $${reg.notes.expectedAmount}`);
        }
      });
    }

    if (investigation.issues.length > 0) {
      console.log('\n⚠️  Issues Found:');
      investigation.issues.forEach((issue, idx) => {
        console.log(`  ${idx + 1}. ${issue}`);
      });
    } else {
      console.log('\n✅ No issues found');
    }
  }

  // Analyze patterns
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('PATTERN ANALYSIS');
  console.log('='.repeat(80));

  const totalUsers = results.length;
  const usersWithPlayerRecords = results.filter(r => r.hasPlayerRecord).length;
  const usersWithClerkAccounts = results.filter(r => r.hasClerkAccount).length;
  const usersWithPendingPayments = results.filter(r => r.hasPendingPayments).length;
  const usersWithFailedPayments = results.filter(r => r.hasFailedPayments).length;
  const usersWithIssues = results.filter(r => r.issues.length > 0).length;

  console.log(`\nTotal Users Investigated: ${totalUsers}`);
  console.log(`Users with Player Records: ${usersWithPlayerRecords} (${(usersWithPlayerRecords / totalUsers * 100).toFixed(1)}%)`);
  console.log(`Users with Clerk Accounts: ${usersWithClerkAccounts} (${(usersWithClerkAccounts / totalUsers * 100).toFixed(1)}%)`);
  console.log(`Users with Pending Payments: ${usersWithPendingPayments} (${(usersWithPendingPayments / totalUsers * 100).toFixed(1)}%)`);
  console.log(`Users with Failed Payments: ${usersWithFailedPayments} (${(usersWithFailedPayments / totalUsers * 100).toFixed(1)}%)`);
  console.log(`Users with Issues: ${usersWithIssues} (${(usersWithIssues / totalUsers * 100).toFixed(1)}%)`);

  // Account creation method breakdown
  const accountMethods = results.reduce((acc, r) => {
    const method = r.accountCreationMethod || 'UNKNOWN';
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nAccount Creation Methods:');
  Object.entries(accountMethods).forEach(([method, count]) => {
    console.log(`  ${method}: ${count} (${(count / totalUsers * 100).toFixed(1)}%)`);
  });

  // Common issues
  const allIssues = results.flatMap(r => r.issues);
  const issueCounts = allIssues.reduce((acc, issue) => {
    // Group similar issues
    const key = issue.split(':')[0]; // Get the issue type
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nMost Common Issues:');
  Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([issue, count]) => {
      console.log(`  ${issue}: ${count} occurrences`);
    });

  // Users without Clerk accounts
  const usersWithoutClerk = results.filter(r => !r.hasClerkAccount && r.hasPlayerRecord);
  if (usersWithoutClerk.length > 0) {
    console.log('\n⚠️  Users without Clerk accounts (may indicate manual profile creation):');
    usersWithoutClerk.forEach(u => {
      console.log(`  - ${u.email}`);
    });
  }

  // Users with pending payments but no Stripe session
  const usersWithPendingNoSession = results.filter(r => 
    r.hasPendingPayments && 
    r.registrations.some(reg => reg.paymentStatus === 'PENDING' && !reg.stripeSessionId)
  );
  if (usersWithPendingNoSession.length > 0) {
    console.log('\n⚠️  Users with pending payments but no Stripe session:');
    usersWithPendingNoSession.forEach(u => {
      console.log(`  - ${u.email}`);
      u.registrations
        .filter(reg => reg.paymentStatus === 'PENDING' && !reg.stripeSessionId)
        .forEach(reg => {
          console.log(`    Registration ${reg.id} for ${reg.tournamentName}`);
        });
    });
  }

  console.log('\n');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

