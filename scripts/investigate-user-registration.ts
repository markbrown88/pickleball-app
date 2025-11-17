import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

async function investigateUser(email: string) {
  try {
    console.log(`\n=== Investigating: ${email} ===\n`);

    // Find player
    const player = await prisma.player.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        club: {
          select: {
            name: true,
            city: true,
            region: true,
          },
        },
      },
    });

    if (!player) {
      console.log('❌ Player not found');
      return;
    }

    console.log(`✅ Player Found:`);
    console.log(`   ID: ${player.id}`);
    console.log(`   Name: ${player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim()}`);
    console.log(`   Email: ${player.email}`);
    console.log(`   Phone: ${player.phone || 'N/A'}`);
    console.log(`   Club: ${player.club?.name || 'N/A'} (${player.club?.city || ''}, ${player.club?.region || ''})`);
    console.log(`   Clerk User ID: ${player.clerkUserId || 'N/A'}`);
    console.log(``);

    // Find all registrations
    const registrations = await prisma.tournamentRegistration.findMany({
      where: { playerId: player.id },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            registrationStatus: true,
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    if (registrations.length === 0) {
      console.log('❌ No registrations found');
    } else {
      console.log(`✅ Found ${registrations.length} registration(s):\n`);
      
      for (const reg of registrations) {
        console.log(`📋 Registration ID: ${reg.id}`);
        console.log(`   Tournament: ${reg.tournament.name}`);
        console.log(`   Status: ${reg.status}`);
        console.log(`   Payment Status: ${reg.paymentStatus}`);
        console.log(`   Amount Paid: $${(reg.amountPaid / 100).toFixed(2)}`);
        console.log(`   Expected Amount: $${reg.expectedAmount ? (reg.expectedAmount / 100).toFixed(2) : 'N/A'}`);
        console.log(`   Registered: ${reg.registeredAt.toISOString()}`);
        
        // Parse notes
        if (reg.notes) {
          try {
            const notes = JSON.parse(reg.notes);
            console.log(`   Notes:`);
            if (notes.stopIds) console.log(`     - Stop IDs: ${JSON.stringify(notes.stopIds)}`);
            if (notes.brackets) console.log(`     - Brackets: ${JSON.stringify(notes.brackets)}`);
            if (notes.subtotal) console.log(`     - Subtotal: $${(notes.subtotal / 100).toFixed(2)}`);
            if (notes.tax) console.log(`     - Tax: $${(notes.tax / 100).toFixed(2)}`);
            if (notes.expectedAmount) console.log(`     - Expected Total: $${(notes.expectedAmount / 100).toFixed(2)}`);
            if (notes.newStopsTotal) console.log(`     - New Stops Total: $${(notes.newStopsTotal / 100).toFixed(2)}`);
            if (notes.existingAmountPaid) console.log(`     - Existing Amount Paid: $${(notes.existingAmountPaid / 100).toFixed(2)}`);
          } catch (e) {
            console.log(`     - Raw notes: ${reg.notes}`);
          }
        }

        // Check Stripe for this registration
        if (reg.amountPaid > 0) {
          console.log(`\n   🔍 Checking Stripe for payments...`);
          
          // Search by customer email
          const customers = await stripe.customers.list({
            email: email.toLowerCase(),
            limit: 10,
          });

          if (customers.data.length > 0) {
            console.log(`   Found ${customers.data.length} Stripe customer(s)`);
            
            for (const customer of customers.data) {
              // Get payment intents
              const paymentIntents = await stripe.paymentIntents.list({
                customer: customer.id,
                limit: 10,
              });

              if (paymentIntents.data.length > 0) {
                console.log(`   Found ${paymentIntents.data.length} payment intent(s) for customer ${customer.id}:`);
                
                for (const pi of paymentIntents.data) {
                  console.log(`     - Payment Intent: ${pi.id}`);
                  console.log(`       Status: ${pi.status}`);
                  console.log(`       Amount: $${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`);
                  console.log(`       Created: ${new Date(pi.created * 1000).toISOString()}`);
                  
                  if (pi.metadata?.registrationId) {
                    console.log(`       Registration ID in metadata: ${pi.metadata.registrationId}`);
                    if (pi.metadata.registrationId === reg.id) {
                      console.log(`       ✅ MATCHES this registration!`);
                    }
                  }
                }
              }

              // Get checkout sessions
              const sessions = await stripe.checkout.sessions.list({
                customer: customer.id,
                limit: 10,
              });

              if (sessions.data.length > 0) {
                console.log(`   Found ${sessions.data.length} checkout session(s):`);
                
                for (const session of sessions.data) {
                  console.log(`     - Session: ${session.id}`);
                  console.log(`       Status: ${session.status}`);
                  console.log(`       Payment Status: ${session.payment_status}`);
                  console.log(`       Amount Total: $${session.amount_total ? (session.amount_total / 100).toFixed(2) : 'N/A'} ${session.currency?.toUpperCase() || ''}`);
                  console.log(`       Created: ${new Date(session.created * 1000).toISOString()}`);
                  
                  if (session.metadata?.registrationId || session.client_reference_id) {
                    const regId = session.metadata?.registrationId || session.client_reference_id;
                    console.log(`       Registration ID: ${regId}`);
                    if (regId === reg.id) {
                      console.log(`       ✅ MATCHES this registration!`);
                    }
                  }
                }
              }
            }
          } else {
            // Search by amount
            console.log(`   No Stripe customer found. Searching by amount...`);
            const amountInCents = reg.amountPaid;
            
            const paymentIntents = await stripe.paymentIntents.list({
              limit: 100,
            });

            const matchingPIs = paymentIntents.data.filter(pi => 
              pi.amount === amountInCents && 
              (pi.metadata?.registrationId === reg.id || pi.receipt_email === email.toLowerCase())
            );

            if (matchingPIs.length > 0) {
              console.log(`   Found ${matchingPIs.length} matching payment intent(s):`);
              matchingPIs.forEach(pi => {
                console.log(`     - ${pi.id}: $${(pi.amount / 100).toFixed(2)} - Status: ${pi.status}`);
              });
            } else {
              console.log(`   ⚠️  No matching Stripe payment found for amount $${(amountInCents / 100).toFixed(2)}`);
            }
          }
        } else {
          console.log(`   ⚠️  No payment recorded (amountPaid = 0)`);
        }

        console.log(``);
      }
    }

  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/investigate-user-registration.ts <email>');
  process.exit(1);
}

investigateUser(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

