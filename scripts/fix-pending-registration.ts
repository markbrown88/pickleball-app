import { PrismaClient } from '@prisma/client';
import { sendPaymentReceiptEmail } from '../src/server/email';

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function fixPendingRegistration(registrationId: string) {
  try {
    console.log(`\n=== Fixing Pending Registration: ${registrationId} ===\n`);

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
      console.log(`❌ Registration not found: ${registrationId}`);
      return;
    }

    console.log(`✅ Found registration:`);
    console.log(`   Tournament: ${registration.tournament.name}`);
    console.log(`   Player: ${registration.player.name || `${registration.player.firstName} ${registration.player.lastName}`}`);
    console.log(`   Current Status: ${registration.status}`);
    console.log(`   Current Payment Status: ${registration.paymentStatus}`);
    console.log(`   Amount Paid: ${registration.amountPaid ? `$${(registration.amountPaid / 100).toFixed(2)}` : 'None'}`);
    console.log(`   Payment ID: ${registration.paymentId || 'None'}`);

    // Parse notes
    let notes: any = {};
    if (registration.notes) {
      try {
        notes = JSON.parse(registration.notes);
        console.log(`\n   Notes:`);
        console.log(`     Stripe Session ID: ${notes.stripeSessionId || 'None'}`);
        console.log(`     Payment Intent ID: ${notes.paymentIntentId || 'None'}`);
        console.log(`     Expected Amount: ${notes.expectedAmount ? `$${(notes.expectedAmount / 100).toFixed(2)}` : 'None'}`);
        console.log(`     Stop IDs: ${notes.stopIds ? notes.stopIds.join(', ') : 'None'}`);
      } catch (e) {
        console.log(`   ⚠️  Could not parse notes`);
      }
    }

    // Check if payment was actually made
    if (registration.amountPaid && registration.amountPaid > 0) {
      console.log(`\n✅ Registration has amountPaid set ($${(registration.amountPaid / 100).toFixed(2)})`);
      console.log(`   This suggests payment was processed but status wasn't updated`);
      
      if (registration.paymentStatus === 'PENDING') {
        console.log(`\n🔧 Updating payment status to PAID...`);
        
        await prisma.tournamentRegistration.update({
          where: { id: registrationId },
          data: {
            status: 'REGISTERED',
            paymentStatus: 'PAID',
            // Use paymentIntentId from notes if available, otherwise keep existing paymentId
            paymentId: registration.paymentId || notes.paymentIntentId || undefined,
          },
        });

        console.log(`✅ Registration status updated to PAID`);

        // Send payment receipt email
        if (registration.player.email) {
          console.log(`\n📧 Sending payment receipt email...`);
          
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
            to: registration.player.email,
            playerName,
            tournamentName: registration.tournament.name,
            tournamentId: registration.tournamentId,
            amountPaid: registration.amountPaid || 0,
            paymentDate: registration.registeredAt,
            transactionId: registration.paymentId || notes.paymentIntentId || undefined,
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

          console.log(`✅ Payment receipt email sent`);
        }
      } else {
        console.log(`\nℹ️  Payment status is already ${registration.paymentStatus}`);
      }
    } else {
      console.log(`\n⚠️  Registration has no amountPaid set`);
      console.log(`   This registration may not have been paid yet`);
      console.log(`   Expected amount: ${notes.expectedAmount ? `$${(notes.expectedAmount / 100).toFixed(2)}` : 'Unknown'}`);
    }

    console.log(`\n✅ Fix complete`);

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const registrationId = process.argv[2];
if (!registrationId) {
  console.error('Usage: npx tsx scripts/fix-pending-registration.ts <registrationId>');
  console.error('Example: npx tsx scripts/fix-pending-registration.ts cmi2inj8l0001kz04ps174gth');
  process.exit(1);
}

fixPendingRegistration(registrationId)
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

