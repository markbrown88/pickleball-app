import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { prisma } from '@/server/db';

import { AppShell } from '../shared/AppShell';
import { getAvailableUsers } from '../shared/getAvailableUsers';
import { ProfileGuard } from './ProfileGuard';

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
  let realPlayer = await prisma.player.findUnique({
    where: { clerkUserId: user.id },
    select: { 
      id: true, 
      isAppAdmin: true,
      firstName: true,
      lastName: true,
      clubId: true,
    }
  });

  // If no Player record exists, create one automatically (fallback if webhook didn't work)
  if (!realPlayer) {
    const userEmail = user.emailAddresses?.[0]?.emailAddress;
    
    if (!userEmail) {
      // No email, can't create player - redirect to homepage (not sign-in to avoid redirect loop)
      console.error('Layout: User has no email address. Cannot create Player.');
      redirect('/');
    }

    try {
      // Find a default club to assign to the new player
      const defaultClub = await prisma.club.findFirst({
        orderBy: { name: 'asc' },
        select: { id: true },
      });

      if (!defaultClub) {
        console.error('Layout: No clubs found in database. Cannot create Player without a club.');
        redirect('/');
      }

      // Get name from Clerk user
      const firstName = user.firstName || null;
      const lastName = user.lastName || null;
      const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || null;

      // Check if a player already exists with this email (but no clerkUserId)
      const existingPlayerByEmail = await prisma.player.findUnique({
        where: { email: userEmail.toLowerCase() },
        select: {
          id: true,
          clerkUserId: true,
          isAppAdmin: true,
          firstName: true,
          lastName: true,
          clubId: true,
        }
      });

      if (existingPlayerByEmail) {
        // Update existing player with clerkUserId
        realPlayer = await prisma.player.update({
          where: { id: existingPlayerByEmail.id },
          data: {
            clerkUserId: user.id,
            firstName: firstName || existingPlayerByEmail.firstName,
            lastName: lastName || existingPlayerByEmail.lastName,
            name: name || existingPlayerByEmail.firstName && existingPlayerByEmail.lastName ? `${existingPlayerByEmail.firstName} ${existingPlayerByEmail.lastName}` : null,
          },
          select: {
            id: true,
            isAppAdmin: true,
            firstName: true,
            lastName: true,
            clubId: true,
          }
        });
      } else {
        // Create new player record
        realPlayer = await prisma.player.create({
          data: {
            clerkUserId: user.id,
            email: userEmail.toLowerCase(),
            firstName,
            lastName,
            name,
            gender: 'MALE', // Default, can be updated later
            country: 'Canada', // Default for this application
            clubId: defaultClub.id, // Required field - assign to first available club
          },
          select: {
            id: true,
            isAppAdmin: true,
            firstName: true,
            lastName: true,
            clubId: true,
          }
        });
      }

    } catch (createError: any) {
      console.error('Layout: Error creating Player record automatically:', createError);
      // If creation fails, redirect to homepage (not sign-in to avoid redirect loop)
      redirect('/');
    }
  }

  // Profile completion check is handled by ProfileGuard (client-side)
  // This allows users to access /profile to complete their profile
  // ProfileGuard will redirect incomplete profiles away from other routes
  // We don't do server-side redirect here to avoid redirect loops when accessing /profile

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
    <ProfileGuard>
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
    </ProfileGuard>
  );
}


