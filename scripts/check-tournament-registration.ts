import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTournamentRegistration() {
  try {
    // Find the tournament by name (case insensitive)
    const tournament = await prisma.tournament.findFirst({
      where: {
        name: {
          contains: 'pickleplex finale',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        registrationStatus: true,
        registrationType: true,
        registrationOpens: true,
        registrationDeadline: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!tournament) {
      console.log('❌ Tournament not found');
      return;
    }

    console.log('\n🏆 Tournament Found:');
    console.log('='.repeat(60));
    console.log(`ID: ${tournament.id}`);
    console.log(`Name: ${tournament.name}`);
    console.log(`Registration Status: ${tournament.registrationStatus}`);
    console.log(`Registration Type: ${tournament.registrationType}`);
    console.log(`Registration Opens: ${tournament.registrationOpens || 'Not set'}`);
    console.log(`Registration Deadline: ${tournament.registrationDeadline || 'Not set'}`);
    console.log(`Start Date: ${tournament.startDate || 'Not set'}`);
    console.log(`End Date: ${tournament.endDate || 'Not set'}`);
    console.log(`Created: ${tournament.createdAt}`);
    console.log(`Updated: ${tournament.updatedAt}`);
    console.log('='.repeat(60));

    // Check if registration button should show
    const shouldShowRegistration = tournament.registrationStatus !== 'INVITE_ONLY';
    console.log(`\n✓ Registration button should show: ${shouldShowRegistration ? 'YES' : 'NO'}`);

    if (tournament.registrationStatus === 'INVITE_ONLY') {
      console.log('⚠️  Status is INVITE_ONLY - registration button will not appear');
    } else if (tournament.registrationStatus === 'OPEN') {
      console.log('✓ Status is OPEN - registration button should appear');
    } else if (tournament.registrationStatus === 'CLOSED') {
      console.log('⚠️  Status is CLOSED - registration button will not appear (if filtered out)');
    }

  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTournamentRegistration();
