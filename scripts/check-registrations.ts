import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRegistrations(email: string) {
  try {
    const player = await prisma.player.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, email: true },
    });

    if (!player) {
      console.log(`❌ Player not found`);
      return;
    }

    console.log(`\nPlayer: ${player.name} (${player.email})`);
    console.log(`Player ID: ${player.id}\n`);

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
      console.log(`✅ No tournament registrations found`);
    } else {
      console.log(`✅ Found ${registrations.length} registration(s):\n`);
      registrations.forEach((reg, idx) => {
        console.log(`${idx + 1}. Tournament: ${reg.tournament.name}`);
        console.log(`   Registration ID: ${reg.id}`);
        console.log(`   Status: ${reg.status}`);
        console.log(`   Payment Status: ${reg.paymentStatus}`);
        console.log(`   Registered: ${reg.registeredAt.toISOString()}`);
        console.log(``);
      });
    }

  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/check-registrations.ts <email>');
  process.exit(1);
}

checkRegistrations(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

