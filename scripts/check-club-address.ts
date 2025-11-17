import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkClubAddress() {
  const club = await prisma.club.findFirst({
    where: { 
      name: { contains: 'Oshawa', mode: 'insensitive' } 
    },
    select: { 
      name: true, 
      address: true,
      address1: true, 
      city: true, 
      region: true, 
      postalCode: true 
    }
  });
  
  console.log('Club data:', JSON.stringify(club, null, 2));
  await prisma.$disconnect();
}

checkClubAddress();

