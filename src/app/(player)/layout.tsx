import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { cookies, headers } from 'next/headers';
import { prisma } from '@/server/db';

import { AppShell } from '../shared/AppShell';
import { getAvailableUsers } from '../shared/getAvailableUsers';

async function getUserRoleByPlayerId(playerId: string): Promise<'app-admin' | 'tournament-admin' | 'event-manager' | 'captain' | 'player'> {
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

export default async function PlayerLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();

  if (!user) {
    redirect('/');
  }

  // Get the real authenticated user's player record with profile completion check
  const realPlayer = await prisma.player.findUnique({
    where: { clerkUserId: user.id },
    select: { 
      id: true, 
      isAppAdmin: true,
      firstName: true,
      lastName: true,
      clubId: true,
    }
  });

  if (!realPlayer) {
    redirect('/');
  }

  // Profile completion check is now handled in middleware.ts
  // This ensures users cannot access any routes until profile is complete

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
    } else {
      // Target player doesn't exist (deleted), clear the Act As cookie
      console.warn('Act As target player not found, clearing cookie:', actAsPlayerId);
      // Note: We can't clear cookies from server-side, but the client will handle this
    }
  }

  const userRole = await getUserRoleByPlayerId(effectivePlayerId);
  const availableUsers = await getAvailableUsers(realPlayer.isAppAdmin ? 'app-admin' : userRole);

  return (
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
  );
}


