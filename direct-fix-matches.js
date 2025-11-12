const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function directFix() {
  try {
    // Get match 12
    const match12 = await prisma.match.findUnique({
      where: { id: 'cmhvbnhv400jvr00ofrofwtzg' },
    });
    console.log('Match 12 teamAId:', match12?.teamAId);

    // Get match 13
    const match13 = await prisma.match.findUnique({
      where: { id: 'cmhvbnibq00k7r00ofin7hj09' },
    });
    console.log('Match 13 teamAId:', match13?.teamAId);

    // If they have teamAId, clear it
    if (match12?.teamAId) {
      await prisma.match.update({
        where: { id: 'cmhvbnhv400jvr00ofrofwtzg' },
        data: { teamAId: null },
      });
      console.log('✓ Cleared match 12 teamAId');
    }

    if (match13?.teamAId) {
      await prisma.match.update({
        where: { id: 'cmhvbnibq00k7r00ofin7hj09' },
        data: { teamAId: null },
      });
      console.log('✓ Cleared match 13 teamAId');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

directFix();
