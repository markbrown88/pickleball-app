import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const failedRegistrations = await prisma.tournamentRegistration.findMany({
    where: {
      paymentStatus: 'FAILED',
      player: {
        email: { not: 'markbrown8@gmail.com' }
      }
    },
    include: {
      player: {
        select: { id: true, email: true, firstName: true, lastName: true }
      },
      tournament: {
        select: { id: true, name: true }
      }
    },
    orderBy: { registeredAt: 'desc' }
  });

  console.log(`Found ${failedRegistrations.length} failed payment(s):\n`);

  for (const reg of failedRegistrations) {
    console.log('='.repeat(60));
    console.log('Player:', reg.player.firstName, reg.player.lastName, `(${reg.player.email})`);
    console.log('Tournament:', reg.tournament.name);
    console.log('Registration ID:', reg.id);
    console.log('Registered At:', reg.registeredAt);
    console.log('Payment ID:', reg.paymentId || 'N/A');
    console.log('Amount:', reg.amountPaid ? '$' + (reg.amountPaid / 100).toFixed(2) : 'N/A');
    
    if (reg.notes) {
      try {
        const notes = JSON.parse(reg.notes);
        console.log('Stop IDs:', notes.stopIds || 'N/A');
        console.log('Stripe Session ID:', notes.stripeSessionId || 'N/A');
        console.log('Payment Intent ID:', notes.paymentIntentId || 'N/A');
        if (notes.expectedAmount) console.log('Expected Amount: $' + notes.expectedAmount.toFixed(2));
      } catch {
        console.log('Notes (raw):', reg.notes);
      }
    }
    console.log('');
  }
}
main().finally(() => prisma.$disconnect());
