import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function revertStatus(registrationId: string) {
  await prisma.tournamentRegistration.update({
    where: { id: registrationId },
    data: { paymentStatus: 'PENDING' }
  });
  console.log('Reverted to PENDING');
  await prisma.$disconnect();
}

revertStatus('cmi2inj8l0001kz04ps174gth');

