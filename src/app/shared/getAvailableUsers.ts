import { prisma } from '@/server/db';

export async function getAvailableUsers(userRole: 'app-admin' | 'tournament-admin' | 'captain' | 'player') {
  if (userRole !== 'app-admin') {
    return [];
  }

  const players = await prisma.player.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isAppAdmin: true,
      TournamentCaptain: { select: { tournamentId: true }, take: 1 },
      tournamentAdminLinks: { select: { tournamentId: true }, take: 1 },
      TournamentEventManager: { select: { tournamentId: true }, take: 1 },
    },
    orderBy: [
      { lastName: 'asc' },
      { firstName: 'asc' },
    ],
  });

  return players.map(player => {
    const hasTournamentAdminRole =
      player.tournamentAdminLinks.length > 0 || player.TournamentEventManager.length > 0;
    const hasCaptainRole = player.TournamentCaptain.length > 0;

    let role: 'app-admin' | 'tournament-admin' | 'captain' | 'player';
    if (player.isAppAdmin) role = 'app-admin';
    else if (hasTournamentAdminRole) role = 'tournament-admin';
    else if (hasCaptainRole) role = 'captain';
    else role = 'player';

    return {
      id: player.id,
      name: `${player.firstName} ${player.lastName}`.trim(),
      role,
      email: player.email ?? undefined,
    };
  });
}

