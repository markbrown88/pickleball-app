import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

import { prisma } from '@/server/db';

import { AdminProvider, type AdminUser } from './AdminContext';
import { AdminShell } from './AdminShell';

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

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

function buildNavItems(user: AdminUser): NavItem[] {
  return [
    { href: '/admin', label: 'Tournaments', exact: true },
    { href: '/dashboard', label: 'Dashboard' },
    ...(user.isAppAdmin || user.isTournamentAdmin || user.isCaptain
      ? [{ href: '/admin/rosters', label: 'Rosters' } satisfies NavItem]
      : []),
    { href: '/tournaments', label: 'Scoreboards' },
    ...(user.isAppAdmin ? [{ href: '/admin/clubs', label: 'Clubs' } satisfies NavItem] : []),
    ...(user.isAppAdmin || user.isTournamentAdmin
      ? [{ href: '/admin/players', label: 'Players' } satisfies NavItem]
      : []),
  ];
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const adminUser = await loadAdminUser();

  if (!adminUser) {
    redirect('/dashboard');
  }

  if (!adminUser.isAppAdmin && !adminUser.isTournamentAdmin && !adminUser.isCaptain) {
    redirect('/dashboard');
  }

  const navItems = buildNavItems(adminUser);

  return (
    <AdminProvider value={adminUser}>
      <AdminShell adminUser={adminUser} navItems={navItems}>
        {children}
      </AdminShell>
    </AdminProvider>
  );
}
