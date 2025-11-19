import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function lookupTransaction(paymentIntentId: string) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY is not set in environment variables');
    process.exit(1);
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });

  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`LOOKING UP STRIPE TRANSACTION: ${paymentIntentId}`);
    console.log('='.repeat(80));

    // Look up the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    console.log(`\n📊 Payment Intent Details:`);
    console.log(`   ID: ${paymentIntent.id}`);
    console.log(`   Status: ${paymentIntent.status}`);
    console.log(`   Amount: $${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}`);
    console.log(`   Created: ${new Date(paymentIntent.created * 1000).toISOString()}`);
    console.log(`   Customer: ${paymentIntent.customer || 'N/A'}`);
    console.log(`   Receipt Email: ${paymentIntent.receipt_email || 'N/A'}`);
    
    if (paymentIntent.metadata) {
      console.log(`\n📝 Metadata:`);
      Object.entries(paymentIntent.metadata).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }

    // Try to find associated registration
    const registrationId = paymentIntent.metadata?.registrationId;
    const tournamentId = paymentIntent.metadata?.tournamentId;
    
    if (registrationId) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`FINDING REGISTRATION: ${registrationId}`);
      console.log('='.repeat(80));

      const registration = await prisma.tournamentRegistration.findUnique({
        where: { id: registrationId },
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
          stops: {
            include: {
              club: {
                select: {
                  name: true,
                  city: true,
                  region: true,
                },
              },
              brackets: {
                include: {
                  bracket: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              startAt: 'asc',
            },
          },
        },
      });

      if (registration) {
        console.log(`\n👤 Player:`);
        console.log(`   Name: ${registration.player.firstName || ''} ${registration.player.lastName || ''}`.trim() || 'N/A');
        console.log(`   Email: ${registration.player.email || 'No email'}`);
        console.log(`   Player ID: ${registration.player.id}`);

        console.log(`\n🏆 Tournament:`);
        console.log(`   Name: ${registration.tournament.name}`);
        console.log(`   Type: ${registration.tournament.type}`);
        console.log(`   Tournament ID: ${registration.tournament.id}`);

        console.log(`\n📋 Registration Details:`);
        console.log(`   Status: ${registration.status}`);
        console.log(`   Payment Status: ${registration.paymentStatus}`);
        console.log(`   Amount Paid: $${((registration.amountPaid || 0) / 100).toFixed(2)}`);
        console.log(`   Registered At: ${registration.registeredAt.toISOString()}`);
        if (registration.paidAt) {
          console.log(`   Paid At: ${registration.paidAt.toISOString()}`);
        }

        console.log(`\n📍 Stops Registered For:`);
        if (registration.stops.length > 0) {
          registration.stops.forEach((stop, idx) => {
            console.log(`\n   ${idx + 1}. ${stop.name}`);
            console.log(`      Club: ${stop.club.name} (${stop.club.city || 'N/A'}, ${stop.club.region || 'N/A'})`);
            if (stop.startAt) {
              console.log(`      Start: ${new Date(stop.startAt).toLocaleDateString()}`);
            }
            if (stop.endAt) {
              console.log(`      End: ${new Date(stop.endAt).toLocaleDateString()}`);
            }
            
            if (stop.brackets.length > 0) {
              console.log(`      Brackets:`);
              stop.brackets.forEach((sb, bIdx) => {
                console.log(`         ${bIdx + 1}. ${sb.bracket.name}`);
              });
            }
          });
        } else {
          console.log(`   No stops found`);
        }

        // Check if there are notes with additional info
        if (registration.notes) {
          try {
            const notes = JSON.parse(registration.notes);
            if (Object.keys(notes).length > 0) {
              console.log(`\n📝 Registration Notes:`);
              if (notes.stopIds) {
                console.log(`   Stop IDs: ${JSON.stringify(notes.stopIds)}`);
              }
              if (notes.brackets) {
                console.log(`   Brackets: ${JSON.stringify(notes.brackets)}`);
              }
              if (notes.playerInfo) {
                console.log(`   Player Info: ${JSON.stringify(notes.playerInfo)}`);
              }
            }
          } catch (e) {
            // Notes not JSON, skip
          }
        }

      } else {
        console.log(`\n❌ Registration ${registrationId} not found in database`);
      }
    } else {
      console.log(`\n⚠️  No registrationId found in payment intent metadata`);
      console.log(`   Searching by tournament ID and amount...`);
      
      if (tournamentId && paymentIntent.amount) {
        const amountInCents = paymentIntent.amount;
        const registrations = await prisma.tournamentRegistration.findMany({
          where: {
            tournamentId: tournamentId,
            amountPaid: amountInCents,
            paymentStatus: 'PAID',
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
              },
            },
          },
          orderBy: {
            paidAt: 'desc',
          },
          take: 5,
        });

        if (registrations.length > 0) {
          console.log(`\n🔍 Found ${registrations.length} potential registration(s) with matching amount:`);
          registrations.forEach((reg, idx) => {
            console.log(`\n   ${idx + 1}. Registration ID: ${reg.id}`);
            console.log(`      Player: ${reg.player.firstName || ''} ${reg.player.lastName || ''}`.trim() || 'N/A');
            console.log(`      Email: ${reg.player.email || 'No email'}`);
            console.log(`      Paid At: ${reg.paidAt ? reg.paidAt.toISOString() : 'N/A'}`);
          });
        }
      }
    }

    // Also check checkout sessions
    if (paymentIntent.metadata?.checkoutSessionId) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`CHECKOUT SESSION: ${paymentIntent.metadata.checkoutSessionId}`);
      console.log('='.repeat(80));
      
      try {
        const session = await stripe.checkout.sessions.retrieve(paymentIntent.metadata.checkoutSessionId);
        console.log(`   Session ID: ${session.id}`);
        console.log(`   Status: ${session.status}`);
        console.log(`   Customer Email: ${session.customer_email || 'N/A'}`);
        if (session.metadata) {
          console.log(`   Metadata:`);
          Object.entries(session.metadata).forEach(([key, value]) => {
            console.log(`      ${key}: ${value}`);
          });
        }
      } catch (e: any) {
        console.log(`   Error retrieving session: ${e.message}`);
      }
    }

  } catch (error: any) {
    console.error(`\n❌ Error looking up transaction:`, error.message);
    if (error.type === 'StripeInvalidRequestError') {
      console.error(`   This might be a test transaction but you're using a live key, or vice versa.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/lookup-stripe-transaction.ts <paymentIntentId>');
    console.error('Example: npx tsx scripts/lookup-stripe-transaction.ts pi_3SUg6sDnHE5trALU270o8yhL');
    process.exit(1);
  }

  const paymentIntentId = args[0];
  await lookupTransaction(paymentIntentId);
}

main();

