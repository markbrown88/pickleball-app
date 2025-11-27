import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function investigatePaymentIntent(paymentIntentId: string) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`INVESTIGATING PAYMENT INTENT: ${paymentIntentId}`);
    console.log('='.repeat(80));

    // Search in paymentId field
    console.log(`\n🔍 Searching by paymentId field...`);
    const byPaymentId = await prisma.tournamentRegistration.findMany({
      where: {
        paymentId: paymentIntentId,
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
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

    if (byPaymentId.length > 0) {
      console.log(`✅ Found ${byPaymentId.length} registration(s) with paymentId = ${paymentIntentId}:`);
      byPaymentId.forEach((reg, idx) => {
        console.log(`\n   ${idx + 1}. Registration ID: ${reg.id}`);
        console.log(`      Player: ${reg.player.firstName || ''} ${reg.player.lastName || ''}`.trim() || 'N/A');
        console.log(`      Email: ${reg.player.email || 'No email'}`);
        console.log(`      Phone: ${reg.player.phone || 'No phone'}`);
        console.log(`      Tournament: ${reg.tournament.name} (${reg.tournament.type})`);
        console.log(`      Status: ${reg.status}`);
        console.log(`      Payment Status: ${reg.paymentStatus}`);
        console.log(`      Amount Paid: $${((reg.amountPaid || 0) / 100).toFixed(2)}`);
        console.log(`      Registered At: ${reg.registeredAt.toISOString()}`);
        if (reg.paidAt) {
          console.log(`      Paid At: ${reg.paidAt.toISOString()}`);
        }
      });
    } else {
      console.log(`   ❌ No registrations found with paymentId = ${paymentIntentId}`);
    }

    // Search in notes field (contains paymentIntentId)
    console.log(`\n🔍 Searching in notes field for paymentIntentId...`);
    const allRegistrations = await prisma.tournamentRegistration.findMany({
      where: {
        notes: {
          contains: paymentIntentId,
        },
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
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

    if (allRegistrations.length > 0) {
      console.log(`✅ Found ${allRegistrations.length} registration(s) with paymentIntentId in notes:`);
      allRegistrations.forEach((reg, idx) => {
        console.log(`\n   ${idx + 1}. Registration ID: ${reg.id}`);
        console.log(`      Player: ${reg.player.firstName || ''} ${reg.player.lastName || ''}`.trim() || 'N/A');
        console.log(`      Email: ${reg.player.email || 'No email'}`);
        console.log(`      Phone: ${reg.player.phone || 'No phone'}`);
        console.log(`      Tournament: ${reg.tournament.name} (${reg.tournament.type})`);
        console.log(`      Status: ${reg.status}`);
        console.log(`      Payment Status: ${reg.paymentStatus}`);
        console.log(`      Amount Paid: $${((reg.amountPaid || 0) / 100).toFixed(2)}`);
        console.log(`      Payment ID: ${reg.paymentId || 'None'}`);
        console.log(`      Registered At: ${reg.registeredAt.toISOString()}`);
        if (reg.paidAt) {
          console.log(`      Paid At: ${reg.paidAt.toISOString()}`);
        }

        // Try to parse notes
        if (reg.notes) {
          try {
            const notes = JSON.parse(reg.notes);
            if (notes.paymentIntentId || notes.processedPayments) {
              console.log(`      Notes - paymentIntentId: ${notes.paymentIntentId || 'N/A'}`);
              if (notes.processedPayments) {
                console.log(`      Notes - processedPayments: ${JSON.stringify(notes.processedPayments)}`);
              }
            }
          } catch (e) {
            // Not JSON, skip
          }
        }
      });
    } else {
      console.log(`   ❌ No registrations found with paymentIntentId in notes`);
    }

    // Also check if it's a partial match (maybe truncated or different format)
    const shortId = paymentIntentId.substring(0, 20);
    console.log(`\n🔍 Searching for partial match (first 20 chars: ${shortId})...`);
    const partialMatches = await prisma.tournamentRegistration.findMany({
      where: {
        OR: [
          { paymentId: { contains: shortId } },
          { notes: { contains: shortId } },
        ],
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

    if (partialMatches.length > 0) {
      console.log(`⚠️  Found ${partialMatches.length} registration(s) with partial match:`);
      partialMatches.forEach((reg, idx) => {
        console.log(`\n   ${idx + 1}. Registration ID: ${reg.id}`);
        console.log(`      Player: ${reg.player.firstName || ''} ${reg.player.lastName || ''}`.trim() || 'N/A');
        console.log(`      Payment ID: ${reg.paymentId || 'None'}`);
      });
    } else {
      console.log(`   ❌ No partial matches found`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`SUMMARY`);
    console.log('='.repeat(80));
    console.log(`Payment Intent ID: ${paymentIntentId}`);
    console.log(`Exact matches in paymentId: ${byPaymentId.length}`);
    console.log(`Matches in notes: ${allRegistrations.length}`);
    console.log(`Partial matches: ${partialMatches.length}`);

    if (byPaymentId.length === 0 && allRegistrations.length === 0 && partialMatches.length === 0) {
      console.log(`\n⚠️  This payment intent ID is not found in the database.`);
      console.log(`   Possible reasons:`);
      console.log(`   - The payment intent doesn't exist in Stripe (test vs live key mismatch)`);
      console.log(`   - The payment was never processed or linked to a registration`);
      console.log(`   - The payment intent ID is incorrect`);
    }

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npx tsx scripts/investigate-payment-intent.ts <paymentIntentId>');
  process.exit(1);
}

investigatePaymentIntent(args[0]);

