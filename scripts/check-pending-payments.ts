import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkPendingPayments() {
  const pendingRegistrations = await prisma.tournamentRegistration.findMany({
    where: {
      paymentStatus: 'PENDING',
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
        },
      },
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: {
      registeredAt: 'desc',
    },
  });

  console.log(`\n📊 PENDING PAYMENTS: ${pendingRegistrations.length}\n`);

  if (pendingRegistrations.length === 0) {
    console.log('No pending payments found.');
  } else {
    pendingRegistrations.forEach((reg, idx) => {
      const playerName = reg.player.firstName && reg.player.lastName
        ? `${reg.player.firstName} ${reg.player.lastName}`
        : reg.player.email || 'Unknown';

      console.log(`${idx + 1}. Registration ID: ${reg.id}`);
      console.log(`   Player: ${playerName} (${reg.player.email || 'No email'})`);
      console.log(`   Tournament: ${reg.tournament.name}`);
      console.log(`   Amount Paid: $${((reg.amountPaid || 0) / 100).toFixed(2)}`);
      console.log(`   Payment ID: ${reg.paymentId || 'None'}`);
      console.log(`   Registered: ${reg.registeredAt.toISOString()}`);
      console.log(`   Days since registration: ${Math.floor((Date.now() - reg.registeredAt.getTime()) / (1000 * 60 * 60 * 24))}`);
      console.log('');
    });
  }

  await prisma.$disconnect();
}

checkPendingPayments();

