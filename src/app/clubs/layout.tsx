import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { prisma } from '@/server/db';
import { AppShell } from '../shared/AppShell';
import type { UserRole } from '../shared/Navigation';
import { getAvailableUsers } from '../shared/getAvailableUsers';
import { AdminProvider, type AdminUser } from '../admin/AdminContext';

async function loadAdminUserByPlayerId(playerId: string): Promise<AdminUser | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      clubId: true,
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
    clubId: player.clubId || '',
    isAppAdmin: player.isAppAdmin,
    isTournamentAdmin: hasTournamentAdminRole,
    isCaptain: hasCaptainRole,
  };
}

async function getUserRoleByPlayerId(playerId: string): Promise<UserRole> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      isAppAdmin: true,
      TournamentCaptain: { select: { tournamentId: true }, take: 1 },
      tournamentAdminLinks: { select: { tournamentId: true }, take: 1 },
      TournamentEventManager: { select: { tournamentId: true }, take: 1 },
    },
  });

  if (!player) {
    return 'player';
  }

  // Check if player is an event manager (either at stop-level or tournament-level)
  const eventManagerStops = await prisma.stop.findFirst({
    where: { eventManagerId: player.id },
    select: { id: true },
  });

  const hasTournamentAdminRole = player.tournamentAdminLinks.length > 0;
  const hasCaptainRole = player.TournamentCaptain.length > 0;
  const hasEventManagerRole = eventManagerStops !== null || player.TournamentEventManager.length > 0;

  if (player.isAppAdmin) return 'app-admin';
  if (hasTournamentAdminRole) return 'tournament-admin';
  if (hasEventManagerRole) return 'event-manager';
  if (hasCaptainRole) return 'captain';
  return 'player';
}

export default async function ClubsLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();

  if (!user) {
    redirect('/');
  }

  // Get the real authenticated user's player record
  const realPlayer = await prisma.player.findUnique({
    where: { clerkUserId: user.id },
    select: {
      id: true,
      isAppAdmin: true,
    }
  });

  if (!realPlayer) {
    redirect('/dashboard');
  }

  // Check for Act As cookie (set by client-side ActAsContext)
  const cookieStore = await cookies();
  const actAsPlayerId = cookieStore.get('act-as-player-id')?.value;

  // Determine the effective player ID (for role detection)
  let effectivePlayerId = realPlayer.id;
  if (actAsPlayerId && realPlayer.isAppAdmin) {
    // Validate target player exists
    const targetPlayer = await prisma.player.findUnique({
      where: { id: actAsPlayerId },
      select: { id: true }
    });
    if (targetPlayer) {
      effectivePlayerId = actAsPlayerId;
    }
  }

  // Get role and admin user based on effective player (respects Act As)
  const adminUser = await loadAdminUserByPlayerId(effectivePlayerId);
  const userRole = await getUserRoleByPlayerId(effectivePlayerId);
  const availableUsers = await getAvailableUsers(realPlayer.isAppAdmin ? 'app-admin' : userRole);

  // Only app-admin and tournament-admin can access this page
  if (userRole !== 'app-admin' && userRole !== 'tournament-admin') {
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
        showActAs={realPlayer.isAppAdmin}
        availableUsers={availableUsers}
      >
        {children}
      </AppShell>
    </AdminProvider>
  );
}
