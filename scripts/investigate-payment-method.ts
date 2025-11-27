import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

async function investigatePaymentMethod(paymentMethodId: string, userEmail?: string) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`INVESTIGATING PAYMENT METHOD: ${paymentMethodId}`);
    if (userEmail) {
      console.log(`FOR USER: ${userEmail}`);
    }
    console.log('='.repeat(80));

    if (!stripe) {
      console.log(`\n❌ STRIPE_SECRET_KEY not configured`);
      return;
    }

    // Retrieve the payment method
    console.log(`\n💳 Payment Method Details:`);
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      console.log(`   ID: ${paymentMethod.id}`);
      console.log(`   Type: ${paymentMethod.type}`);
      console.log(`   Created: ${new Date(paymentMethod.created * 1000).toISOString()}`);
      
      if (paymentMethod.card) {
        console.log(`   Card:`);
        console.log(`      Brand: ${paymentMethod.card.brand}`);
        console.log(`      Last 4: ${paymentMethod.card.last4}`);
        console.log(`      Exp Month: ${paymentMethod.card.exp_month}`);
        console.log(`      Exp Year: ${paymentMethod.card.exp_year}`);
      }
      
      if (paymentMethod.billing_details) {
        console.log(`   Billing Details:`);
        if (paymentMethod.billing_details.email) {
          console.log(`      Email: ${paymentMethod.billing_details.email}`);
        }
        if (paymentMethod.billing_details.name) {
          console.log(`      Name: ${paymentMethod.billing_details.name}`);
        }
        if (paymentMethod.billing_details.phone) {
          console.log(`      Phone: ${paymentMethod.billing_details.phone}`);
        }
      }

      if (paymentMethod.customer) {
        const customerId = typeof paymentMethod.customer === 'string' 
          ? paymentMethod.customer 
          : paymentMethod.customer.id;
        console.log(`   Customer ID: ${customerId}`);
        
        // Retrieve customer details
        try {
          const customer = await stripe.customers.retrieve(customerId);
          if (typeof customer !== 'string' && !customer.deleted) {
            console.log(`\n👤 Customer Details:`);
            console.log(`   Email: ${customer.email || 'N/A'}`);
            console.log(`   Name: ${customer.name || 'N/A'}`);
            console.log(`   Phone: ${customer.phone || 'N/A'}`);
            if (customer.metadata) {
              console.log(`   Metadata: ${JSON.stringify(customer.metadata, null, 2)}`);
            }
          }
        } catch (e: any) {
          console.log(`   ⚠️  Could not retrieve customer: ${e.message}`);
        }
      }

    } catch (e: any) {
      console.log(`   ❌ Error retrieving payment method: ${e.message}`);
      if (e.type === 'StripeInvalidRequestError') {
        console.log(`      (This might be a test payment method but you're using a live key, or vice versa)`);
      }
      return;
    }

    // Search for payment intents that used this payment method
    console.log(`\n🔍 Searching for Payment Intents using this payment method...`);
    try {
      const paymentIntents = await stripe.paymentIntents.list({
        limit: 100,
      });

      const matchingPIs = paymentIntents.data.filter(pi => {
        // Check if payment method is attached to this payment intent
        if (pi.payment_method === paymentMethodId) return true;
        if (typeof pi.payment_method === 'object' && pi.payment_method?.id === paymentMethodId) return true;
        
        // Check charges
        if (pi.charges?.data) {
          return pi.charges.data.some((charge: any) => 
            charge.payment_method === paymentMethodId
          );
        }
        return false;
      });

      if (matchingPIs.length > 0) {
        console.log(`   ✅ Found ${matchingPIs.length} payment intent(s) using this payment method:\n`);
        
        for (let i = 0; i < matchingPIs.length; i++) {
          const pi = matchingPIs[i];
          console.log(`   ${i + 1}. Payment Intent: ${pi.id}`);
          console.log(`      Status: ${pi.status}`);
          console.log(`      Amount: $${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`);
          console.log(`      Created: ${new Date(pi.created * 1000).toISOString()}`);
          console.log(`      Customer: ${pi.customer || 'N/A'}`);
          console.log(`      Receipt Email: ${pi.receipt_email || 'N/A'}`);
          
          if (pi.metadata) {
            console.log(`      Metadata:`);
            Object.entries(pi.metadata).forEach(([key, value]) => {
              console.log(`         ${key}: ${value}`);
            });
          }

          // Check for charges
          if (pi.charges && pi.charges.data.length > 0) {
            console.log(`      Charges:`);
            pi.charges.data.forEach((charge: any, idx: number) => {
              console.log(`         ${idx + 1}. ${charge.id}: $${(charge.amount / 100).toFixed(2)} - Status: ${charge.status}`);
              if (charge.receipt_url) {
                console.log(`            Receipt: ${charge.receipt_url}`);
              }
            });
          }

          // Search database for this payment intent
          console.log(`\n      🔍 Database Search:`);
          const registration = await prisma.tournamentRegistration.findFirst({
            where: {
              paymentId: pi.id,
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
          });

          if (registration) {
            console.log(`         ✅ Found registration: ${registration.id}`);
            console.log(`            Player: ${registration.player.firstName || ''} ${registration.player.lastName || ''}`.trim() || 'N/A');
            console.log(`            Email: ${registration.player.email || 'No email'}`);
            console.log(`            Tournament: ${registration.tournament.name}`);
            console.log(`            Status: ${registration.status}`);
            console.log(`            Payment Status: ${registration.paymentStatus}`);
            console.log(`            Amount Paid: $${((registration.amountPaid || 0) / 100).toFixed(2)}`);
          } else {
            // Search in notes
            const registrationsInNotes = await prisma.tournamentRegistration.findMany({
              where: {
                notes: {
                  contains: pi.id,
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
                  },
                },
              },
              take: 5,
            });

            if (registrationsInNotes.length > 0) {
              console.log(`         ⚠️  Found ${registrationsInNotes.length} registration(s) with this payment intent in notes:`);
              registrationsInNotes.forEach((reg, idx) => {
                console.log(`            ${idx + 1}. ${reg.id} - ${reg.player.firstName || ''} ${reg.player.lastName || ''}`.trim() || 'N/A');
                console.log(`               Email: ${reg.player.email || 'No email'}`);
                console.log(`               Tournament: ${reg.tournament.name}`);
              });
            } else {
              console.log(`         ❌ No registration found in database`);
            }
          }

          console.log(``);
        }
      } else {
        console.log(`   ❌ No payment intents found using this payment method`);
        
        // Try searching all payment intents more broadly
        console.log(`\n   🔍 Searching all recent payment intents for any reference...`);
        const recentPIs = paymentIntents.data.slice(0, 20);
        const recentMatching = recentPIs.filter(pi => {
          if (pi.metadata) {
            return Object.values(pi.metadata).some(val => 
              typeof val === 'string' && val.includes(paymentMethodId)
            );
          }
          return false;
        });

        if (recentMatching.length > 0) {
          console.log(`   ⚠️  Found ${recentMatching.length} payment intent(s) with payment method ID in metadata:`);
          recentMatching.forEach((pi, idx) => {
            console.log(`      ${idx + 1}. ${pi.id} - $${(pi.amount / 100).toFixed(2)}`);
          });
        }
      }
    } catch (e: any) {
      console.log(`   ❌ Error searching payment intents: ${e.message}`);
    }

    // If user email provided, search for registrations
    if (userEmail) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`SEARCHING REGISTRATIONS FOR: ${userEmail}`);
      console.log('='.repeat(80));

      const player = await prisma.player.findFirst({
        where: { email: userEmail },
        select: { id: true },
      });

      if (player) {
        const registrations = await prisma.tournamentRegistration.findMany({
          where: { playerId: player.id },
          include: {
            tournament: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            registeredAt: 'desc',
          },
        });

        console.log(`\nFound ${registrations.length} registration(s) for this user:`);
        registrations.forEach((reg, idx) => {
          console.log(`\n   ${idx + 1}. Registration: ${reg.id}`);
          console.log(`      Tournament: ${reg.tournament.name}`);
          console.log(`      Payment ID: ${reg.paymentId || 'None'}`);
          console.log(`      Amount Paid: $${((reg.amountPaid || 0) / 100).toFixed(2)}`);
          console.log(`      Payment Status: ${reg.paymentStatus}`);
          
          if (reg.notes) {
            try {
              const notes = JSON.parse(reg.notes);
              if (notes.paymentIntentId) {
                console.log(`      Payment Intent ID (from notes): ${notes.paymentIntentId}`);
              }
              if (notes.processedPayments) {
                console.log(`      Processed Payments: ${notes.processedPayments.length}`);
                notes.processedPayments.forEach((p: any, pIdx: number) => {
                  console.log(`         ${pIdx + 1}. ${p.paymentIntentId} - $${((p.amount || 0) / 100).toFixed(2)}`);
                });
              }
            } catch (e) {
              // Not JSON
            }
          }
        });
      } else {
        console.log(`\n❌ No player found with email: ${userEmail}`);
      }
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
  console.error('Usage: npx tsx scripts/investigate-payment-method.ts <paymentMethodId> [userEmail]');
  console.error('Example: npx tsx scripts/investigate-payment-method.ts pm_1SUt71DnHE5trALUCJmo87zX dtoppi3@gmail.com');
  process.exit(1);
}

const paymentMethodId = args[0];
const userEmail = args[1];

investigatePaymentMethod(paymentMethodId, userEmail);

