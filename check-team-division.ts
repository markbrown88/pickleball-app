import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    where: { tournamentId: 'cmfot1xt50000rd6a1gvw8ozn' },
    include: { club: true },
  });

  for (const team of teams) {
    console.log(`Team: ${team.name}, Club: ${team.club?.name}, Division: ${team.division || 'N/A'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
