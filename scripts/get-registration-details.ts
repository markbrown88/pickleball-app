import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function getRegistrationDetails(registrationId: string) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`REGISTRATION DETAILS: ${registrationId}`);
    console.log('='.repeat(80));

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
            phone: true,
            city: true,
            region: true,
            clerkUserId: true,
            createdAt: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            registrationType: true,
            registrationCost: true,
            pricingModel: true,
          },
        },
      },
    });

    if (!registration) {
      console.log(`❌ Registration not found`);
      return;
    }

    console.log(`\n👤 PLAYER INFORMATION:`);
    console.log(`   ID: ${registration.player.id}`);
    console.log(`   Name: ${registration.player.name || `${registration.player.firstName || ''} ${registration.player.lastName || ''}`.trim() || 'N/A'}`);
    console.log(`   Email: ${registration.player.email || 'No email'}`);
    console.log(`   Phone: ${registration.player.phone || 'No phone'}`);
    console.log(`   Location: ${registration.player.city || 'N/A'}, ${registration.player.region || 'N/A'}`);
    console.log(`   Clerk User ID: ${registration.player.clerkUserId || 'No Clerk account'}`);
    console.log(`   Player Created: ${registration.player.createdAt.toISOString()}`);

    console.log(`\n🏆 TOURNAMENT INFORMATION:`);
    console.log(`   ID: ${registration.tournament.id}`);
    console.log(`   Name: ${registration.tournament.name}`);
    console.log(`   Type: ${registration.tournament.type}`);
    console.log(`   Registration Type: ${registration.tournament.registrationType}`);
    console.log(`   Registration Cost: $${((registration.tournament.registrationCost || 0) / 100).toFixed(2)}`);
    console.log(`   Pricing Model: ${registration.tournament.pricingModel || 'N/A'}`);

    console.log(`\n📋 REGISTRATION DETAILS:`);
    console.log(`   Registration ID: ${registration.id}`);
    console.log(`   Status: ${registration.status}`);
    console.log(`   Payment Status: ${registration.paymentStatus}`);
    console.log(`   Payment Method: ${registration.paymentMethod || 'N/A'}`);
    console.log(`   Payment ID: ${registration.paymentId || 'None'}`);
    console.log(`   Amount Paid: $${((registration.amountPaid || 0) / 100).toFixed(2)}`);
    console.log(`   Registered At: ${registration.registeredAt.toISOString()}`);
    if (registration.paidAt) {
      console.log(`   Paid At: ${registration.paidAt.toISOString()}`);
    }
    if (registration.withdrawnAt) {
      console.log(`   Withdrawn At: ${registration.withdrawnAt.toISOString()}`);
    }

    // Query roster entries separately
    const rosters = await prisma.stopTeamPlayer.findMany({
      where: {
        playerId: registration.playerId,
        stop: {
          tournamentId: registration.tournamentId,
        },
      },
      include: {
        stop: {
          select: {
            id: true,
            name: true,
            startAt: true,
            endAt: true,
            club: {
              select: {
                name: true,
                city: true,
                region: true,
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

    // Get unique stops from rosters
    const uniqueStops = new Map();
    rosters.forEach(roster => {
      if (!uniqueStops.has(roster.stop.id)) {
        uniqueStops.set(roster.stop.id, roster.stop);
      }
    });

    console.log(`\n📍 STOPS REGISTERED FOR (${uniqueStops.size}):`);
    if (uniqueStops.size > 0) {
      Array.from(uniqueStops.values()).forEach((stop: any, idx) => {
        console.log(`\n   ${idx + 1}. ${stop.name}`);
        console.log(`      Stop ID: ${stop.id}`);
        console.log(`      Club: ${stop.club.name} (${stop.club.city || 'N/A'}, ${stop.club.region || 'N/A'})`);
        if (stop.startAt) {
          console.log(`      Start: ${new Date(stop.startAt).toLocaleString()}`);
        }
        if (stop.endAt) {
          console.log(`      End: ${new Date(stop.endAt).toLocaleString()}`);
        }
      });
    } else {
      console.log(`   No stops found`);
    }

    console.log(`\n👥 ROSTER ENTRIES (${rosters.length}):`);
    if (rosters.length > 0) {
      rosters.forEach((roster, idx) => {
        console.log(`\n   ${idx + 1}. Stop: ${roster.stop.name}`);
        console.log(`      Team: ${roster.team?.name || 'No team'}`);
        console.log(`      Payment Method: ${roster.paymentMethod || 'N/A'}`);
        console.log(`      Created: ${roster.createdAt.toISOString()}`);
      });
    } else {
      console.log(`   No roster entries found`);
    }

    // Parse and display notes
    if (registration.notes) {
      try {
        const notes = JSON.parse(registration.notes);
        console.log(`\n📝 REGISTRATION NOTES:`);
        if (notes.stopIds) {
          console.log(`   Stop IDs: ${JSON.stringify(notes.stopIds)}`);
        }
        if (notes.brackets) {
          console.log(`   Brackets: ${JSON.stringify(notes.brackets, null, 2)}`);
        }
        if (notes.clubId) {
          console.log(`   Club ID: ${notes.clubId}`);
        }
        if (notes.playerInfo) {
          console.log(`   Player Info: ${JSON.stringify(notes.playerInfo, null, 2)}`);
        }
        if (notes.subtotal !== undefined) {
          console.log(`   Subtotal: $${notes.subtotal.toFixed(2)}`);
        }
        if (notes.tax !== undefined) {
          console.log(`   Tax: $${notes.tax.toFixed(2)}`);
        }
        if (notes.expectedAmount !== undefined) {
          console.log(`   Expected Amount: $${notes.expectedAmount.toFixed(2)}`);
        }
        if (notes.pricingModel) {
          console.log(`   Pricing Model: ${notes.pricingModel}`);
        }
        if (notes.stripeSessionId) {
          console.log(`   Stripe Session ID: ${notes.stripeSessionId}`);
        }
        if (notes.paymentIntentId) {
          console.log(`   Payment Intent ID: ${notes.paymentIntentId}`);
        }
        if (notes.processedPayments) {
          console.log(`   Processed Payments: ${JSON.stringify(notes.processedPayments, null, 2)}`);
        }
        if (notes.paidStops) {
          console.log(`   Paid Stops: ${JSON.stringify(notes.paidStops, null, 2)}`);
        }
      } catch (e) {
        console.log(`\n📝 REGISTRATION NOTES (raw):`);
        console.log(`   ${registration.notes.substring(0, 500)}${registration.notes.length > 500 ? '...' : ''}`);
      }
    }

    console.log(`\n${'='.repeat(80)}`);

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npx tsx scripts/get-registration-details.ts <registrationId>');
  process.exit(1);
}

getRegistrationDetails(args[0]);

