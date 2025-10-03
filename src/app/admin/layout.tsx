import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

import { prisma } from '@/server/db';

import { AdminProvider, type AdminUser } from './AdminContext';
import { AppShell } from '../shared/AppShell';
import { getAvailableUsers } from '../shared/getAvailableUsers';

async function loadAdminUser(): Promise<AdminUser | null> {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const player = await prisma.player.findUnique({
    where: { clerkUserId: userId },
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
  });

  if (!player) {
    return null;
  }

  const hasTournamentAdminRole =
    player.tournamentAdminLinks.length > 0 || player.TournamentEventManager.length > 0;
  const hasCaptainRole = player.TournamentCaptain.length > 0;

  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    email: player.email,
    isAppAdmin: player.isAppAdmin,
    isTournamentAdmin: hasTournamentAdminRole,
    isCaptain: hasCaptainRole,
  };
}

function getUserRole(adminUser: AdminUser): 'app-admin' | 'tournament-admin' | 'captain' {
  if (adminUser.isAppAdmin) return 'app-admin';
  if (adminUser.isTournamentAdmin) return 'tournament-admin';
  return 'captain';
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const adminUser = await loadAdminUser();

  if (!adminUser) {
    redirect('/dashboard');
  }

  if (!adminUser.isAppAdmin && !adminUser.isTournamentAdmin && !adminUser.isCaptain) {
    redirect('/dashboard');
  }

  const userRole = getUserRole(adminUser);
  const availableUsers = await getAvailableUsers(userRole);

  return (
    <AdminProvider value={adminUser}>
      <AppShell
        userRole={userRole}
        userInfo={{
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email ?? undefined,
        }}
        showActAs={adminUser.isAppAdmin}
        availableUsers={availableUsers}
      >
        {children}
      </AppShell>
    </AdminProvider>
  );
}
