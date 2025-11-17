/**
 * Script to send a payment receipt email
 * 
 * Usage:
 *   npx tsx scripts/send-payment-receipt-email.ts <email> [registrationId]
 * 
 * Examples:
 *   # Send test email with sample data
 *   npx tsx scripts/send-payment-receipt-email.ts mark@lilyfairjewelry.com
 * 
 *   # Resend email for a specific registration
 *   npx tsx scripts/send-payment-receipt-email.ts mark@lilyfairjewelry.com cmhxmgmqy0001kw049bqlvovu
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { sendPaymentReceiptEmail } from '../src/server/email';

const prisma = new PrismaClient();

async function sendPaymentReceipt(email: string, registrationId?: string) {
  try {
    console.log(`\n📧 Sending payment receipt email to: ${email}`);
    
    // If no registrationId provided, try to find a recent paid registration for this email
    if (!registrationId) {
      console.log(`\nLooking for recent paid registration for: ${email}`);
      
      const player = await prisma.player.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true },
      });

      if (player) {
        const recentRegistration = await prisma.tournamentRegistration.findFirst({
          where: {
            playerId: player.id,
            paymentStatus: 'PAID',
          },
          orderBy: {
            registeredAt: 'desc',
          },
          select: {
            id: true,
            tournament: {
              select: {
                name: true,
              },
            },
          },
        });

        if (recentRegistration) {
          console.log(`\nFound recent paid registration: ${recentRegistration.id}`);
          console.log(`   Tournament: ${recentRegistration.tournament.name}`);
          registrationId = recentRegistration.id;
        }
      }
    }
    
    if (registrationId) {
      // Find the specific registration and use its data
      console.log(`\nLooking up registration: ${registrationId}`);
      
      const registration = await prisma.tournamentRegistration.findUnique({
        where: { id: registrationId },
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
            include: {
              stops: {
                orderBy: { startAt: 'asc' },
                include: {
                  club: {
                    select: {
                      name: true,
                      address: true,
                      address1: true,
                      city: true,
                      region: true,
                      postalCode: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!registration) {
        throw new Error(`Registration ${registrationId} not found`);
      }

      if (!registration.player) {
        throw new Error(`Player not found for registration ${registrationId}`);
      }

      // Parse registration notes
      let notes: any = {};
      if (registration.notes) {
        try {
          notes = JSON.parse(registration.notes);
        } catch (e) {
          console.warn('Failed to parse registration notes:', e);
        }
      }

      const stopIds: string[] = notes.stopIds || [];
      
      // Get bracket names from roster entries if they exist
      let bracketMap = new Map<string, string>();
      if (stopIds.length > 0) {
        const rosterEntries = await prisma.stopTeamPlayer.findMany({
          where: {
            stopId: { in: stopIds },
            playerId: registration.playerId,
          },
          include: {
            team: {
              include: {
                bracket: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });

        for (const roster of rosterEntries) {
          if (roster.team?.bracket?.name) {
            bracketMap.set(roster.stopId, roster.team.bracket.name);
          }
        }
      }

      // Build stops array
      const stops = stopIds.length > 0
        ? registration.tournament.stops
            .filter(stop => stopIds.includes(stop.id))
            .map((stop) => ({
              id: stop.id,
              name: stop.name,
              startAt: stop.startAt,
              endAt: stop.endAt,
              bracketName: bracketMap.get(stop.id) || null,
              club: stop.club ? {
                name: stop.club.name,
                address: stop.club.address,
                address1: stop.club.address1,
                city: stop.club.city,
                region: stop.club.region,
                postalCode: stop.club.postalCode,
              } : null,
            }))
        : [];

      // Get club name for team tournaments
      let clubName: string | null = null;
      if (notes.clubId) {
        try {
          const club = await prisma.club.findUnique({
            where: { id: notes.clubId },
            select: { name: true },
          });
          clubName = club?.name || null;
        } catch (e) {
          console.error('Failed to fetch club name:', e);
        }
      }

      const playerName =
        registration.player.name ||
        (registration.player.firstName && registration.player.lastName
          ? `${registration.player.firstName} ${registration.player.lastName}`
          : registration.player.firstName || 'Player');

      await sendPaymentReceiptEmail({
        to: email,
        playerName,
        tournamentName: registration.tournament.name,
        tournamentId: registration.tournamentId,
        amountPaid: registration.amountPaid || 0,
        paymentDate: registration.paidAt || new Date(),
        transactionId: registration.paymentId || undefined,
        startDate: stops.length > 0 ? stops[0]?.startAt || null : (registration.tournament.stops[0]?.startAt || null),
        endDate: stops.length > 0 ? stops[stops.length - 1]?.endAt || null : (registration.tournament.stops[registration.tournament.stops.length - 1]?.endAt || null),
        location: stops.length > 0 ? null : (registration.tournament.stops[0]?.club
          ? [registration.tournament.stops[0].club.name, registration.tournament.stops[0].club.city, registration.tournament.stops[0].club.region]
              .filter(Boolean)
              .join(', ')
          : null),
        stops: stops.length > 0 ? stops : undefined,
        clubName,
      });

      console.log(`\n✅ Payment receipt email sent successfully!`);
      console.log(`   Tournament: ${registration.tournament.name}`);
      console.log(`   Amount: $${((registration.amountPaid || 0) / 100).toFixed(2)}`);
      console.log(`   Stops: ${stops.length > 0 ? stops.map(s => s.name).join(', ') : 'N/A'}`);
    } else {
      // Send test email with sample data
      console.log(`\nSending test payment receipt email with sample data...`);
      
      await sendPaymentReceiptEmail({
        to: email,
        playerName: 'Mark Brown',
        tournamentName: 'KLYNG CUP - pickleplex',
        tournamentId: 'cmh7qeb1t0000ju04udwe7w8w',
        amountPaid: 6780, // $67.80
        paymentDate: new Date(),
        transactionId: 'pi_test_1234567890',
        startDate: new Date('2025-11-01'),
        endDate: new Date('2025-11-02'),
        location: null,
        stops: [
          {
            id: 'test-stop-1',
            name: '2nd stop Oshawa',
            startAt: new Date('2025-11-01'),
            endAt: new Date('2025-11-02'),
            bracketName: '2.5',
            club: {
              name: 'Pickleplex Oshawa',
              address1: '123 Main Street',
              city: 'Oshawa',
              region: 'ON',
              postalCode: 'L1H 1A1',
            },
          },
        ],
        clubName: 'Downsview',
      });

      console.log(`\n✅ Test payment receipt email sent successfully!`);
    }
  } catch (error: any) {
    console.error('\n❌ Error sending payment receipt email:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const email = args[0];
const registrationId = args[1];

if (!email) {
  console.error('Usage: npx tsx scripts/send-payment-receipt-email.ts <email> [registrationId]');
  console.error('Example: npx tsx scripts/send-payment-receipt-email.ts mark@lilyfairjewelry.com');
  console.error('Example: npx tsx scripts/send-payment-receipt-email.ts mark@lilyfairjewelry.com cmhxmgmqy0001kw049bqlvovu');
  process.exit(1);
}

sendPaymentReceipt(email, registrationId)
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

