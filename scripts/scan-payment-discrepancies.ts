import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

interface PaymentDiscrepancy {
  registrationId: string;
  playerId: string;
  playerName: string;
  playerEmail: string | null;
  tournamentId: string;
  tournamentName: string;
  stopId: string;
  stopName: string;
  teamId: string;
  teamName: string;
  registrationPaymentStatus: string;
  registrationStatus: string;
  registrationAmountPaid: number | null;
  rosterPaymentMethod: 'STRIPE' | 'MANUAL' | 'UNPAID';
  paymentId: string | null;
}

async function scanPaymentDiscrepancies() {
  try {
    console.log('\n=== Scanning Payment Discrepancies ===\n');
    console.log('Comparing Stripe registration payments with roster Paid/Paid X status...\n');

    const discrepancies: PaymentDiscrepancy[] = [];

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
            name: true,
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
      orderBy: {
        registeredAt: 'desc',
      },
    });

    console.log(`Found ${paidRegistrations.length} paid registrations\n`);

    // Check if tournament is a team tournament
    const { isTeamTournament } = await import('@/lib/tournamentTypeConfig');

    for (const registration of paidRegistrations) {
      const playerName = registration.player.name || 
        (registration.player.firstName && registration.player.lastName
          ? `${registration.player.firstName} ${registration.player.lastName}`
          : registration.player.email || 'Unknown');

      // Parse registration notes to get stopIds
      let stopIds: string[] = [];
      if (registration.notes) {
        try {
          const notes = JSON.parse(registration.notes);
          stopIds = notes.stopIds || [];
        } catch (e) {
          // If notes don't parse as JSON, try to extract stopIds another way
          console.warn(`Failed to parse notes for registration ${registration.id}: ${registration.notes}`);
          continue;
        }
      }

      if (stopIds.length === 0) {
        // No stopIds in registration, skip
        continue;
      }

      const tournamentIsTeam = isTeamTournament(registration.tournament.type);

      if (tournamentIsTeam) {
        // For team tournaments, check roster entries for each stop
        for (const stopId of stopIds) {
          // Get all roster entries for this player and stop
          const rosterEntries = await prisma.stopTeamPlayer.findMany({
            where: {
              playerId: registration.playerId,
              stopId: stopId,
            },
            include: {
              stop: {
                select: {
                  id: true,
                  name: true,
                  tournament: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

          if (rosterEntries.length === 0) {
            // Player is paid but not on roster - this is a different issue
            console.log(`⚠️  ${playerName} (${registration.player.email || 'no email'}) is paid for ${registration.tournament.name} but not on roster for stop ${stopId}`);
            continue;
          }

          // Check each roster entry
          for (const rosterEntry of rosterEntries) {
            // If roster entry is UNPAID but registration is PAID, this is a discrepancy
            if (rosterEntry.paymentMethod === 'UNPAID') {
              discrepancies.push({
                registrationId: registration.id,
                playerId: registration.playerId,
                playerName: playerName,
                playerEmail: registration.player.email,
                tournamentId: registration.tournamentId,
                tournamentName: registration.tournament.name,
                stopId: stopId,
                stopName: rosterEntry.stop.name,
                teamId: rosterEntry.teamId,
                teamName: rosterEntry.team.name,
                registrationPaymentStatus: registration.paymentStatus,
                registrationStatus: registration.status,
                registrationAmountPaid: registration.amountPaid,
                rosterPaymentMethod: rosterEntry.paymentMethod,
                paymentId: registration.paymentId,
              });
            }
          }
        }
      } else {
        // For bracket tournaments, payment is handled differently
        // Skip for now as the user specifically asked about rosters
        continue;
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('PAYMENT DISCREPANCIES FOUND');
    console.log('='.repeat(100));
    console.log(`\nTotal discrepancies: ${discrepancies.length}\n`);

    if (discrepancies.length === 0) {
      console.log('✅ No discrepancies found! All paid registrations have corresponding paid roster entries.\n');
    } else {
      // Group by tournament
      const byTournament = new Map<string, PaymentDiscrepancy[]>();
      for (const disc of discrepancies) {
        if (!byTournament.has(disc.tournamentId)) {
          byTournament.set(disc.tournamentId, []);
        }
        byTournament.get(disc.tournamentId)!.push(disc);
      }

      console.log(`Found discrepancies in ${byTournament.size} tournament(s):\n`);

      for (const [tournamentId, tournamentDiscs] of byTournament.entries()) {
        const tournament = tournamentDiscs[0];
        console.log(`\n📋 ${tournament.tournamentName} (${tournamentDiscs.length} discrepancy/ies)`);
        console.log('-'.repeat(100));

        // Group by stop
        const byStop = new Map<string, PaymentDiscrepancy[]>();
        for (const disc of tournamentDiscs) {
          if (!byStop.has(disc.stopId)) {
            byStop.set(disc.stopId, []);
          }
          byStop.get(disc.stopId)!.push(disc);
        }

        for (const [stopId, stopDiscs] of byStop.entries()) {
          const stop = stopDiscs[0];
          console.log(`\n  🏁 ${stop.stopName} (${stopDiscs.length} player(s)):`);

          for (const disc of stopDiscs) {
            const amountStr = disc.registrationAmountPaid 
              ? `$${(disc.registrationAmountPaid / 100).toFixed(2)}` 
              : 'N/A';
            console.log(`\n    👤 ${disc.playerName}`);
            console.log(`       Email: ${disc.playerEmail || 'None'}`);
            console.log(`       Team: ${disc.teamName}`);
            console.log(`       Registration Status: ${disc.registrationStatus}`);
            console.log(`       Payment Status: ${disc.registrationPaymentStatus}`);
            console.log(`       Amount Paid: ${amountStr}`);
            console.log(`       Payment ID: ${disc.paymentId || 'None'}`);
            console.log(`       Roster Status: ${disc.rosterPaymentMethod} ❌`);
            console.log(`       Registration ID: ${disc.registrationId}`);
            console.log(`       Player ID: ${disc.playerId}`);
            console.log(`       Stop ID: ${disc.stopId}`);
            console.log(`       Team ID: ${disc.teamId}`);
          }
        }
      }

      // Summary statistics
      console.log('\n' + '='.repeat(100));
      console.log('SUMMARY STATISTICS');
      console.log('='.repeat(100));
      
      const uniquePlayers = new Set(discrepancies.map(d => d.playerId));
      const uniqueTournaments = new Set(discrepancies.map(d => d.tournamentId));
      const uniqueStops = new Set(discrepancies.map(d => d.stopId));
      const totalAmount = discrepancies.reduce((sum, d) => sum + (d.registrationAmountPaid || 0), 0);

      console.log(`\nTotal Discrepancies: ${discrepancies.length}`);
      console.log(`Unique Players Affected: ${uniquePlayers.size}`);
      console.log(`Unique Tournaments: ${uniqueTournaments.size}`);
      console.log(`Unique Stops: ${uniqueStops.size}`);
      console.log(`Total Amount Paid: $${(totalAmount / 100).toFixed(2)}`);
      
      // Payment method breakdown
      const withPaymentId = discrepancies.filter(d => d.paymentId).length;
      const withoutPaymentId = discrepancies.filter(d => !d.paymentId).length;
      console.log(`\nRegistrations with Payment ID: ${withPaymentId}`);
      console.log(`Registrations without Payment ID: ${withoutPaymentId}`);
    }

    console.log('\n' + '='.repeat(100));
    console.log('Scan complete!\n');

  } catch (error) {
    console.error('Error scanning payment discrepancies:', error);
  } finally {
    await prisma.$disconnect();
  }
}

scanPaymentDiscrepancies();

