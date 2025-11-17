import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRegistrationNotes(email: string) {
  try {
    const player = await prisma.player.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    if (!player) {
      console.log('Player not found');
      return;
    }

    const registrations = await prisma.tournamentRegistration.findMany({
      where: { playerId: player.id },
      select: {
        id: true,
        notes: true,
        amountPaid: true,
        registeredAt: true,
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    for (const reg of registrations) {
      console.log(`\n=== Registration: ${reg.id} ===`);
      console.log(`Registered: ${reg.registeredAt.toISOString()}`);
      console.log(`Amount Paid (DB): $${(reg.amountPaid / 100).toFixed(2)}`);
      console.log(`Expected Amount (DB): ${reg.expectedAmount ? `$${(reg.expectedAmount / 100).toFixed(2)}` : 'N/A'}`);
      console.log(`\nRaw Notes:`);
      console.log(reg.notes);
      
      if (reg.notes) {
        try {
          const parsed = JSON.parse(reg.notes);
          console.log(`\nParsed Notes:`);
          console.log(JSON.stringify(parsed, null, 2));
          
          if (parsed.subtotal) {
            console.log(`\nSubtotal from notes: $${(parsed.subtotal / 100).toFixed(2)}`);
          }
          if (parsed.tax) {
            console.log(`Tax from notes: $${(parsed.tax / 100).toFixed(2)}`);
          }
          if (parsed.expectedAmount) {
            console.log(`Expected Amount from notes: $${(parsed.expectedAmount / 100).toFixed(2)}`);
          }
        } catch (e) {
          console.log('Failed to parse notes:', e);
        }
      }
    }

  } catch (error: any) {
    console.error(`Error:`, error.message);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/check-registration-notes.ts <email>');
  process.exit(1);
}

checkRegistrationNotes(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

