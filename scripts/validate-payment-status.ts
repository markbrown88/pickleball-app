import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

interface ValidationIssue {
  type: 'MISSING_ROSTER' | 'WRONG_PAYMENT_METHOD' | 'UNPAID_BUT_PAID_REG';
  registrationId: string;
  playerId: string;
  playerName: string;
  playerEmail: string | null;
  tournamentId: string;
  tournamentName: string;
  stopId?: string;
  stopName?: string;
  currentPaymentMethod?: 'STRIPE' | 'MANUAL' | 'UNPAID';
  expectedPaymentMethod: 'STRIPE' | 'MANUAL' | 'UNPAID';
  registrationStatus: string;
  paymentStatus: string;
}

async function validatePaymentStatus() {
  try {
    console.log('Validating payment statuses...\n');
    
    const issues: ValidationIssue[] = [];

    // Find all registrations that are PAID or COMPLETED
    const paidRegistrations = await prisma.tournamentRegistration.findMany({
      where: {
        paymentStatus: {
          in: ['PAID', 'COMPLETED'],
        },
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    console.log(`Found ${paidRegistrations.length} paid registrations\n`);

    // Check if tournament is a team tournament
    const { isTeamTournament } = await import('@/lib/tournamentTypeConfig');

    for (const registration of paidRegistrations) {
      const playerName = registration.player.firstName && registration.player.lastName
        ? `${registration.player.firstName} ${registration.player.lastName}`
        : registration.player.email || 'Unknown';

      // Parse registration notes to get stopIds
      let stopIds: string[] = [];
      if (registration.notes) {
        try {
          const notes = JSON.parse(registration.notes);
          stopIds = notes.stopIds || [];
        } catch (e) {
          console.warn(`Failed to parse notes for registration ${registration.id}`);
          continue;
        }
      }

      if (stopIds.length === 0) {
        continue;
      }

      const tournamentIsTeam = isTeamTournament(registration.tournament.type);

      if (tournamentIsTeam) {
        // For team tournaments, check roster entries
        for (const stopId of stopIds) {
          const rosterEntry = await prisma.stopTeamPlayer.findFirst({
            where: {
              playerId: registration.playerId,
              stopId: stopId,
            },
            include: {
              stop: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

          if (!rosterEntry) {
            issues.push({
              type: 'MISSING_ROSTER',
              registrationId: registration.id,
              playerId: registration.playerId,
              playerName,
              playerEmail: registration.player.email,
              tournamentId: registration.tournamentId,
              tournamentName: registration.tournament.name,
              stopId,
              expectedPaymentMethod: 'STRIPE',
              registrationStatus: registration.status,
              paymentStatus: registration.paymentStatus || 'UNKNOWN',
            });
          } else if (rosterEntry.paymentMethod !== 'STRIPE') {
            issues.push({
              type: 'WRONG_PAYMENT_METHOD',
              registrationId: registration.id,
              playerId: registration.playerId,
              playerName,
              playerEmail: registration.player.email,
              tournamentId: registration.tournamentId,
              tournamentName: registration.tournament.name,
              stopId: rosterEntry.stopId,
              stopName: rosterEntry.stop.name,
              currentPaymentMethod: rosterEntry.paymentMethod,
              expectedPaymentMethod: 'STRIPE',
              registrationStatus: registration.status,
              paymentStatus: registration.paymentStatus || 'UNKNOWN',
            });
          }
        }
      }
    }

    // Also check for roster entries marked as UNPAID but belong to paid registrations
    const allUnpaidRosterEntries = await prisma.stopTeamPlayer.findMany({
      where: {
        paymentMethod: 'UNPAID',
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        stop: {
          select: {
            id: true,
            name: true,
            tournament: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    console.log(`Checking ${allUnpaidRosterEntries.length} unpaid roster entries...\n`);

    for (const rosterEntry of allUnpaidRosterEntries) {
      const tournamentIsTeam = isTeamTournament(rosterEntry.stop.tournament.type);
      
      if (tournamentIsTeam) {
        // Check if this player has a paid registration for this tournament and stop
        const paidRegistration = await prisma.tournamentRegistration.findFirst({
          where: {
            playerId: rosterEntry.playerId,
            tournamentId: rosterEntry.stop.tournamentId,
            paymentStatus: {
              in: ['PAID', 'COMPLETED'],
            },
          },
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            notes: true,
          },
        });

        if (paidRegistration) {
          // Check if this stop is in the registration
          let stopIds: string[] = [];
          if (paidRegistration.notes) {
            try {
              const notes = JSON.parse(paidRegistration.notes);
              stopIds = notes.stopIds || [];
            } catch (e) {
              // Ignore parse errors
            }
          }

          if (stopIds.includes(rosterEntry.stopId)) {
            const playerName = rosterEntry.player.firstName && rosterEntry.player.lastName
              ? `${rosterEntry.player.firstName} ${rosterEntry.player.lastName}`
              : rosterEntry.player.email || 'Unknown';

            issues.push({
              type: 'UNPAID_BUT_PAID_REG',
              registrationId: paidRegistration.id,
              playerId: rosterEntry.playerId,
              playerName,
              playerEmail: rosterEntry.player.email,
              tournamentId: rosterEntry.stop.tournamentId,
              tournamentName: rosterEntry.stop.tournament.name,
              stopId: rosterEntry.stopId,
              stopName: rosterEntry.stop.name,
              currentPaymentMethod: 'UNPAID',
              expectedPaymentMethod: 'STRIPE',
              registrationStatus: paidRegistration.status,
              paymentStatus: paidRegistration.paymentStatus || 'UNKNOWN',
            });
          }
        }
      }
    }

    // Print results
    console.log('='.repeat(80));
    console.log('VALIDATION RESULTS');
    console.log('='.repeat(80));
    console.log(`\nTotal issues found: ${issues.length}\n`);

    if (issues.length === 0) {
      console.log('✅ All payment statuses are correct!');
    } else {
      // Group by type
      const missingRoster = issues.filter(i => i.type === 'MISSING_ROSTER');
      const wrongMethod = issues.filter(i => i.type === 'WRONG_PAYMENT_METHOD');
      const unpaidButPaid = issues.filter(i => i.type === 'UNPAID_BUT_PAID_REG');

      if (missingRoster.length > 0) {
        console.log(`\n❌ MISSING ROSTER ENTRIES (${missingRoster.length}):`);
        console.log('-'.repeat(80));
        missingRoster.forEach((issue, idx) => {
          console.log(`${idx + 1}. ${issue.playerName} (${issue.playerEmail || 'No email'})`);
          console.log(`   Tournament: ${issue.tournamentName}`);
          console.log(`   Stop: ${issue.stopName || issue.stopId}`);
          console.log(`   Registration: ${issue.registrationId}`);
          console.log(`   Status: ${issue.registrationStatus} / ${issue.paymentStatus}`);
          console.log('');
        });
      }

      if (wrongMethod.length > 0) {
        console.log(`\n❌ WRONG PAYMENT METHOD (${wrongMethod.length}):`);
        console.log('-'.repeat(80));
        wrongMethod.forEach((issue, idx) => {
          console.log(`${idx + 1}. ${issue.playerName} (${issue.playerEmail || 'No email'})`);
          console.log(`   Tournament: ${issue.tournamentName}`);
          console.log(`   Stop: ${issue.stopName || issue.stopId}`);
          console.log(`   Current: ${issue.currentPaymentMethod} → Should be: ${issue.expectedPaymentMethod}`);
          console.log(`   Registration: ${issue.registrationId}`);
          console.log(`   Status: ${issue.registrationStatus} / ${issue.paymentStatus}`);
          console.log('');
        });
      }

      if (unpaidButPaid.length > 0) {
        console.log(`\n❌ UNPAID ROSTER BUT PAID REGISTRATION (${unpaidButPaid.length}):`);
        console.log('-'.repeat(80));
        unpaidButPaid.forEach((issue, idx) => {
          console.log(`${idx + 1}. ${issue.playerName} (${issue.playerEmail || 'No email'})`);
          console.log(`   Tournament: ${issue.tournamentName}`);
          console.log(`   Stop: ${issue.stopName || issue.stopId}`);
          console.log(`   Current: ${issue.currentPaymentMethod} → Should be: ${issue.expectedPaymentMethod}`);
          console.log(`   Registration: ${issue.registrationId}`);
          console.log(`   Status: ${issue.registrationStatus} / ${issue.paymentStatus}`);
          console.log('');
        });
      }

      // Ask if user wants to fix
      console.log('\n' + '='.repeat(80));
      console.log('To fix these issues, run: npx tsx scripts/fix-payment-validation-issues.ts');
      console.log('='.repeat(80));
    }

    // Also show summary of manual payments
    const manualCount = await prisma.stopTeamPlayer.count({
      where: { paymentMethod: 'MANUAL' },
    });
    const stripeCount = await prisma.stopTeamPlayer.count({
      where: { paymentMethod: 'STRIPE' },
    });
    const unpaidCount = await prisma.stopTeamPlayer.count({
      where: { paymentMethod: 'UNPAID' },
    });

    console.log('\n' + '='.repeat(80));
    console.log('PAYMENT METHOD SUMMARY');
    console.log('='.repeat(80));
    console.log(`STRIPE (Paid via Stripe): ${stripeCount}`);
    console.log(`MANUAL (Paid External): ${manualCount}`);
    console.log(`UNPAID: ${unpaidCount}`);
    console.log(`Total roster entries: ${stripeCount + manualCount + unpaidCount}`);

    return issues;
  } catch (error) {
    console.error('Validation failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

validatePaymentStatus()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

