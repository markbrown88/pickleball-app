const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearPickeringFromFutureMatches() {
  try {
    const pickleringId = 'cmhpat4an000gr02obwwvmcmv';

    console.log('🔄 Clearing Pickleplex Pickering from matches 12 and 13...\n');

    // Match 12 - should not have Pickering yet
    const match12 = await prisma.match.findFirst({
      where: {
        sourceMatchAId: 'cmhvbngp', // Match 11
      },
      include: {
        round: { select: { idx: true, bracketType: true } },
      },
    });

    if (match12) {
      console.log(`Match 12 (${match12.round?.bracketType} Round ${match12.round?.idx}):`);
      console.log(`  Current teamAId: ${match12.teamAId?.slice(0, 8) || 'null'}`);

      if (match12.teamAId === pickleringId) {
        await prisma.match.update({
          where: { id: match12.id },
          data: { teamAId: null },
        });
        console.log(`  ✓ Cleared teamAId\n`);
      }
    }

    // Match 13 - should not have Pickering yet
    const match13 = await prisma.match.findFirst({
      where: {
        sourceMatchAId: match12?.id,
      },
      include: {
        round: { select: { idx: true, bracketType: true } },
      },
    });

    if (match13) {
      console.log(`Match 13 (${match13.round?.bracketType} Round ${match13.round?.idx}):`);
      console.log(`  Current teamAId: ${match13.teamAId?.slice(0, 8) || 'null'}`);

      if (match13.teamAId === pickleringId) {
        await prisma.match.update({
          where: { id: match13.id },
          data: { teamAId: null },
        });
        console.log(`  ✓ Cleared teamAId\n`);
      }
    }

    console.log('✅ Done\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

clearPickeringFromFutureMatches();
