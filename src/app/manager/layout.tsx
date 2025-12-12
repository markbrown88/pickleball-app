import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/server/db';
import { AppShell } from '../shared/AppShell';
import type { UserRole } from '../shared/Navigation';
import { getAvailableUsers } from '../shared/getAvailableUsers';
import { AdminProvider, type AdminUser } from '../admin/AdminContext';

async function loadAdminUser(userId: string): Promise<AdminUser | null> {
  const player = await prisma.player.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      clubId: true,
      isAppAdmin: true,
      TournamentCaptain: { select: { tournamentId: true }, take: 1 },
      tournamentAdminLinks: { select: { tournamentId: true }, take: 1 },
    },
  });

  if (!player) {
    return null;
  }

  const hasTournamentAdminRole = player.tournamentAdminLinks.length > 0;
  const hasCaptainRole = player.TournamentCaptain.length > 0;

  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    email: player.email,
    clubId: player.clubId,
    isAppAdmin: player.isAppAdmin,
    isTournamentAdmin: hasTournamentAdminRole,
    isCaptain: hasCaptainRole,
  };
}

async function getUserRole(userId: string): Promise<UserRole> {
  const player = await prisma.player.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      isAppAdmin: true,
      TournamentCaptain: { select: { tournamentId: true }, take: 1 },
      tournamentAdminLinks: { select: { tournamentId: true }, take: 1 },
    },
  });

  if (!player) {
    return 'player';
  }

  // Check if player is an event manager for any stops
  const eventManagerStops = await prisma.stop.findFirst({
    where: { eventManagerId: player.id },
    select: { id: true },
  });

  const hasTournamentAdminRole = player.tournamentAdminLinks.length > 0;
  const hasCaptainRole = player.TournamentCaptain.length > 0;
  const hasEventManagerRole = eventManagerStops !== null;

  if (player.isAppAdmin) return 'app-admin';
  if (hasTournamentAdminRole) return 'tournament-admin';
  if (hasEventManagerRole) return 'event-manager';
  if (hasCaptainRole) return 'captain';
  return 'player';
}

export default async function ManagerLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();

  if (!user) {
    redirect('/');
  }

  const adminUser = await loadAdminUser(user.id);
  const userRole = await getUserRole(user.id);
  const availableUsers = await getAvailableUsers(userRole);

  // Only app-admin and event-manager can access Match Control
  if (userRole !== 'app-admin' && userRole !== 'event-manager') {
    redirect('/dashboard');
  }

  if (!adminUser) {
    redirect('/dashboard');
  }

  return (
    <AdminProvider value={adminUser}>
      <AppShell
        userRole={userRole}
        userInfo={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.emailAddresses?.[0]?.emailAddress ?? '',
        }}
        showActAs={userRole === 'app-admin'}
        availableUsers={availableUsers}
        containerClassName="w-full px-8 py-8 space-y-6"
      >
        {children}
      </AppShell>
    </AdminProvider>
  );
}
