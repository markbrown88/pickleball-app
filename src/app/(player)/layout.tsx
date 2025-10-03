import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/server/db';

import { AppShell } from '../shared/AppShell';
import { getAvailableUsers } from '../shared/getAvailableUsers';

async function getUserRole(userId: string): Promise<'app-admin' | 'tournament-admin' | 'captain' | 'player'> {
  const player = await prisma.player.findUnique({
    where: { clerkUserId: userId },
    select: {
      isAppAdmin: true,
      TournamentCaptain: { select: { tournamentId: true }, take: 1 },
      tournamentAdminLinks: { select: { tournamentId: true }, take: 1 },
      TournamentEventManager: { select: { tournamentId: true }, take: 1 },
    },
  });

  if (!player) {
    return 'player';
  }

  const hasTournamentAdminRole =
    player.tournamentAdminLinks.length > 0 || player.TournamentEventManager.length > 0;
  const hasCaptainRole = player.TournamentCaptain.length > 0;

  if (player.isAppAdmin) return 'app-admin';
  if (hasTournamentAdminRole) return 'tournament-admin';
  if (hasCaptainRole) return 'captain';
  return 'player';
}

export default async function PlayerLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();

  if (!user) {
    redirect('/');
  }

  const userRole = await getUserRole(user.id);
  const availableUsers = await getAvailableUsers(userRole);

  return (
    <AppShell
      userRole={userRole}
      userInfo={{
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.emailAddresses?.[0]?.emailAddress ?? '',
      }}
      showActAs={userRole === 'app-admin'}
      availableUsers={availableUsers}
    >
      {children}
    </AppShell>
  );
}


