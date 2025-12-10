// Investigate specific registration
import { prisma } from './src/lib/prisma';

async function investigate() {
    const registrationId = 'cmixdhez60001ic04asa25rik';
    const paymentIntentId = 'pi_3Sc7TrDnHE5trALU3srcyO7M';

    console.log('\n========== Payment Investigation ==========\n');
    console.log(`Registration ID: ${registrationId}`);
    console.log(`Payment Intent: ${paymentIntentId}`);

    // Find the registration
    const registration = await prisma.tournamentRegistration.findUnique({
        where: { id: registrationId },
        include: {
            player: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                }
            },
            tournament: {
                select: {
                    id: true,
                    name: true,
                    registrationType: true,
                }
            }
        }
    });

    if (!registration) {
        console.log('❌ Registration not found!');
        await prisma.$disconnect();
        return;
    }

    console.log('\n--- Registration Details ---');
    console.log(`Player: ${registration.player?.name || registration.player?.firstName} (${registration.player?.email})`);
    console.log(`Tournament: ${registration.tournament?.name}`);
    console.log(`Status: ${registration.status}`);
    console.log(`Payment Status: ${registration.paymentStatus}`);
    console.log(`Payment ID in DB: ${registration.paymentId || 'NONE'}`);
    console.log(`Amount Paid: $${((registration.amountPaid || 0) / 100).toFixed(2)}`);
    console.log(`Registered At: ${registration.registeredAt}`);

    if (registration.notes) {
        console.log('\n--- Notes (Parsed) ---');
        try {
            const notes = JSON.parse(registration.notes);
            console.log(JSON.stringify(notes, null, 2));
        } catch {
            console.log(`Raw notes: ${registration.notes}`);
        }
    }

    // Check if payment ID matches
    if (registration.paymentId === paymentIntentId) {
        console.log('\n✅ Payment ID matches the transaction');
    } else if (registration.paymentId) {
        console.log(`\n⚠️  Payment ID MISMATCH: DB has ${registration.paymentId}`);
    } else {
        console.log('\n⚠️  No payment ID recorded - webhook may not have processed');
    }

    // Diagnosis
    console.log('\n--- Diagnosis ---');
    if (registration.paymentStatus === 'PAID') {
        console.log('✅ Payment was successful');
    } else if (registration.paymentStatus === 'PENDING') {
        console.log('⚠️  Payment still PENDING - webhook likely did not fire or failed');
        console.log('   Action: Check Stripe webhook logs for this payment intent');
    } else if (registration.paymentStatus === 'FAILED') {
        console.log('❌ Payment marked as FAILED');
        console.log('   Action: Check Stripe dashboard for decline reason');
    }

    await prisma.$disconnect();
    console.log('\n========== End Investigation ==========\n');
}

investigate().catch(async (e) => {
    console.error('Error:', e.message);
    await prisma.$disconnect();
    process.exit(1);
});
