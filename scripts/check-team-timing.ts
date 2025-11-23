import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkTiming() {
  try {
    // Get Erica's registration
    const reg = await prisma.tournamentRegistration.findFirst({
      where: { player: { email: 'seeleyerica5@gmail.com' } },
      orderBy: { registeredAt: 'desc' },
    });

    if (!reg || !reg.notes) {
      console.log('No registration found');
      return;
    }

    const notes = JSON.parse(reg.notes);
    const paymentTime = notes.paidStops?.[0]?.paidAt || reg.registeredAt;

    console.log('Payment completed:', paymentTime);

    // Get the team
    const team = await prisma.team.findFirst({
      where: {
        name: { contains: 'Pickleplex Belleville 4.0+' },
        tournamentId: reg.tournamentId,
      },
    });

    if (team) {
      console.log('Team created:', team.createdAt);
      console.log('Team name:', team.name);
      console.log('Team ID:', team.id);

      const timeDiff = new Date(team.createdAt).getTime() - new Date(paymentTime).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff > 0) {
        console.log(`\n❌ PROBLEM FOUND: Team was created ${hoursDiff.toFixed(1)} hours AFTER payment!`);
        console.log('The webhook tried to create a roster entry, but the team did not exist yet.');
        console.log('This likely caused the roster creation to fail at line 343-361 in route.ts');
      } else {
        console.log(`\n✅ Team existed ${Math.abs(hoursDiff).toFixed(1)} hours before payment`);
      }
    } else {
      console.log('\n❌ Team not found');
    }

  } finally {
    await prisma.$disconnect();
  }
}

checkTiming();
