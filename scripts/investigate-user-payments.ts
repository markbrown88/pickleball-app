import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';
import Stripe from 'stripe';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

async function investigateUserPayments(email: string) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`INVESTIGATING USER: ${email}`);
    console.log('='.repeat(80));

    // Find player by email
    const player = await prisma.player.findFirst({
      where: {
        email: email,
      },
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
    });

    if (!player) {
      console.log(`\n❌ No player found with email: ${email}`);
      console.log(`   Searching for any registrations with this email in notes...`);
      
      // Try searching in registration notes
      const registrationsByEmail = await prisma.tournamentRegistration.findMany({
        where: {
          notes: {
            contains: email,
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
        take: 10,
      });

      if (registrationsByEmail.length > 0) {
        console.log(`\n⚠️  Found ${registrationsByEmail.length} registration(s) with this email in notes:`);
        registrationsByEmail.forEach((reg, idx) => {
          console.log(`\n   ${idx + 1}. Registration ID: ${reg.id}`);
          console.log(`      Player: ${reg.player.firstName || ''} ${reg.player.lastName || ''}`.trim() || 'N/A');
          console.log(`      Player Email: ${reg.player.email || 'No email'}`);
          console.log(`      Tournament: ${reg.tournament.name}`);
        });
      }
      return;
    }

    console.log(`\n👤 PLAYER INFORMATION:`);
    console.log(`   ID: ${player.id}`);
    console.log(`   Name: ${player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'N/A'}`);
    console.log(`   Email: ${player.email || 'No email'}`);
    console.log(`   Phone: ${player.phone || 'No phone'}`);
    console.log(`   Location: ${player.city || 'N/A'}, ${player.region || 'N/A'}`);
    console.log(`   Clerk User ID: ${player.clerkUserId || 'No Clerk account'}`);
    console.log(`   Created: ${player.createdAt.toISOString()}`);

    // Get all registrations for this player
    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        playerId: player.id,
      },
      include: {
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
      orderBy: {
        registeredAt: 'desc',
      },
    });

    console.log(`\n${'='.repeat(80)}`);
    console.log(`TOURNAMENT REGISTRATIONS (${registrations.length})`);
    console.log('='.repeat(80));

    if (registrations.length === 0) {
      console.log(`\n   No registrations found`);
    } else {
      for (let i = 0; i < registrations.length; i++) {
        const reg = registrations[i];
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`REGISTRATION ${i + 1}/${registrations.length}: ${reg.id}`);
        console.log('─'.repeat(80));

        console.log(`\n🏆 Tournament:`);
        console.log(`   Name: ${reg.tournament.name}`);
        console.log(`   Type: ${reg.tournament.type}`);
        console.log(`   Registration Type: ${reg.tournament.registrationType}`);
        console.log(`   Registration Cost: $${((reg.tournament.registrationCost || 0) / 100).toFixed(2)}`);
        console.log(`   Pricing Model: ${reg.tournament.pricingModel || 'N/A'}`);

        console.log(`\n📋 Registration Details:`);
        console.log(`   Status: ${reg.status}`);
        console.log(`   Payment Status: ${reg.paymentStatus}`);
        console.log(`   Payment Method: ${reg.paymentMethod || 'N/A'}`);
        console.log(`   Payment ID: ${reg.paymentId || 'None'}`);
        console.log(`   Refund ID: ${reg.refundId || 'None'}`);
        console.log(`   Amount Paid: $${((reg.amountPaid || 0) / 100).toFixed(2)}`);
        console.log(`   Registered At: ${reg.registeredAt.toISOString()}`);
        if (reg.paidAt) {
          console.log(`   Paid At: ${reg.paidAt.toISOString()}`);
        }
        if (reg.withdrawnAt) {
          console.log(`   Withdrawn At: ${reg.withdrawnAt.toISOString()}`);
        }

        // Get roster entries for this registration
        const rosters = await prisma.stopTeamPlayer.findMany({
          where: {
            playerId: player.id,
            stop: {
              tournamentId: reg.tournamentId,
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

        if (rosters.length > 0) {
          console.log(`\n📍 Stops & Roster Entries (${rosters.length}):`);
          const uniqueStops = new Map();
          rosters.forEach(roster => {
            if (!uniqueStops.has(roster.stop.id)) {
              uniqueStops.set(roster.stop.id, {
                stop: roster.stop,
                rosters: [],
              });
            }
            uniqueStops.get(roster.stop.id).rosters.push(roster);
          });

          Array.from(uniqueStops.values()).forEach((entry: any, idx) => {
            const stop = entry.stop;
            console.log(`\n   ${idx + 1}. ${stop.name} (${stop.club.name})`);
            console.log(`      Stop ID: ${stop.id}`);
            if (stop.startAt) {
              console.log(`      Dates: ${new Date(stop.startAt).toLocaleDateString()} - ${stop.endAt ? new Date(stop.endAt).toLocaleDateString() : 'N/A'}`);
            }
            entry.rosters.forEach((roster: any, rIdx: number) => {
              console.log(`      Roster ${rIdx + 1}: Team "${roster.team?.name || 'No team'}" - Payment: ${roster.paymentMethod || 'N/A'}`);
            });
          });
        }

        // Parse and display notes
        if (reg.notes) {
          try {
            const notes = JSON.parse(reg.notes);
            console.log(`\n📝 Registration Notes:`);
            
            if (notes.stopIds) {
              console.log(`   Stop IDs: ${JSON.stringify(notes.stopIds)}`);
            }
            if (notes.brackets) {
              console.log(`   Brackets: ${JSON.stringify(notes.brackets, null, 2)}`);
            }
            if (notes.clubId) {
              console.log(`   Club ID: ${notes.clubId}`);
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
            if (notes.processedPayments && Array.isArray(notes.processedPayments)) {
              console.log(`\n   💳 Processed Payments (${notes.processedPayments.length}):`);
              for (let pIdx = 0; pIdx < notes.processedPayments.length; pIdx++) {
                const payment = notes.processedPayments[pIdx];
                console.log(`      ${pIdx + 1}. Payment Intent: ${payment.paymentIntentId || 'N/A'}`);
                console.log(`         Amount: $${((payment.amount || 0) / 100).toFixed(2)}`);
                console.log(`         Processed At: ${payment.processedAt || 'N/A'}`);
                console.log(`         Source: ${payment.source || 'N/A'}`);
                
                // Try to fetch from Stripe
                if (stripe && payment.paymentIntentId) {
                  try {
                    const pi = await stripe.paymentIntents.retrieve(payment.paymentIntentId);
                    console.log(`         ✅ Stripe Status: ${pi.status}`);
                    console.log(`         Stripe Amount: $${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`);
                    console.log(`         Stripe Created: ${new Date(pi.created * 1000).toISOString()}`);
                  } catch (e: any) {
                    console.log(`         ⚠️  Stripe Error: ${e.message}`);
                  }
                }
              }
            }
            if (notes.paidStops && Array.isArray(notes.paidStops)) {
              console.log(`\n   📍 Paid Stops (${notes.paidStops.length}):`);
              notes.paidStops.forEach((paidStop: any, psIdx: number) => {
                console.log(`      ${psIdx + 1}. Payment Intent: ${paidStop.paymentIntentId || 'N/A'}`);
                console.log(`         Stop IDs: ${JSON.stringify(paidStop.stopIds || [])}`);
                console.log(`         Paid At: ${paidStop.paidAt || 'N/A'}`);
              });
            }
          } catch (e) {
            console.log(`\n📝 Registration Notes (raw, first 500 chars):`);
            console.log(`   ${reg.notes.substring(0, 500)}${reg.notes.length > 500 ? '...' : ''}`);
          }
        }

        // Check Stripe if we have a payment ID
        if (stripe && reg.paymentId) {
          console.log(`\n💳 Stripe Payment Intent Check:`);
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(reg.paymentId, {
              expand: ['charges'],
            });
            console.log(`   ✅ Found in Stripe:`);
            console.log(`      Status: ${paymentIntent.status}`);
            console.log(`      Amount: $${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}`);
            console.log(`      Created: ${new Date(paymentIntent.created * 1000).toISOString()}`);
            console.log(`      Customer: ${paymentIntent.customer || 'N/A'}`);
            console.log(`      Receipt Email: ${paymentIntent.receipt_email || 'N/A'}`);
            if (paymentIntent.charges && paymentIntent.charges.data.length > 0) {
              const charge = paymentIntent.charges.data[0];
              console.log(`      Charge ID: ${charge.id}`);
              console.log(`      Charge Status: ${charge.status}`);
              if (charge.receipt_url) {
                console.log(`      Receipt URL: ${charge.receipt_url}`);
              }
            }
            if (paymentIntent.metadata) {
              console.log(`      Metadata: ${JSON.stringify(paymentIntent.metadata, null, 2)}`);
            }
          } catch (e: any) {
            console.log(`   ⚠️  Not found in Stripe: ${e.message}`);
            if (e.type === 'StripeInvalidRequestError') {
              console.log(`      (This might be a test transaction but you're using a live key, or vice versa)`);
            }
          }
        }
      }
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`SUMMARY`);
    console.log('='.repeat(80));
    console.log(`Total Registrations: ${registrations.length}`);
    const paidRegistrations = registrations.filter(r => r.paymentStatus === 'PAID');
    const pendingRegistrations = registrations.filter(r => r.paymentStatus === 'PENDING');
    const totalAmountPaid = registrations.reduce((sum, r) => sum + (r.amountPaid || 0), 0);
    
    console.log(`Paid Registrations: ${paidRegistrations.length}`);
    console.log(`Pending Registrations: ${pendingRegistrations.length}`);
    console.log(`Total Amount Paid: $${(totalAmountPaid / 100).toFixed(2)}`);
    
    if (registrations.length > 0) {
      console.log(`\nRegistration Statuses:`);
      const statusCounts = registrations.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    }

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npx tsx scripts/investigate-user-payments.ts <email>');
  process.exit(1);
}

investigateUserPayments(args[0]);

