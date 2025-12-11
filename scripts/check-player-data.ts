import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const playerId = 'cmj1s6ts00001i6049uzvg2jj'; // mark@lilyfair.com (second duplicate)

  // Check for related data
  const [
    registrations,
    teamPlayers,
    tournamentAdmins,
    tournamentCaptains,
    eventManagers,
    clubDirectors
  ] = await Promise.all([
    prisma.tournamentRegistration.count({ where: { playerId } }),
    prisma.teamPlayer.count({ where: { playerId } }),
    prisma.tournamentAdmin.count({ where: { playerId } }),
    prisma.tournamentCaptain.count({ where: { playerId } }),
    prisma.tournamentEventManager.count({ where: { playerId } }),
    prisma.clubDirector.count({ where: { playerId } })
  ]);

  console.log('Data for mark@lilyfair.com player (cmj1s6ts00001i6049uzvg2jj):');
  console.log(JSON.stringify({ registrations, teamPlayers, tournamentAdmins, tournamentCaptains, eventManagers, clubDirectors }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
