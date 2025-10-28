import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST - Merge two player profiles
 *
 * This merges the secondary player into the primary player by:
 * 1. Transferring all tournament registrations
 * 2. Transferring all team memberships
 * 3. Transferring all tournament invitations
 * 4. Transferring all invite requests
 * 5. Transferring waitlist entries
 * 6. Transferring lineup entries
 * 7. Transferring captain roles
 * 8. Transferring tournament admin roles
 * 9. Disabling the secondary player profile
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check for act-as-player-id cookie
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const actAsPlayerId = cookieStore.get('act-as-player-id')?.value;

    let currentPlayer;
    if (actAsPlayerId) {
      currentPlayer = await prisma.player.findUnique({
        where: { id: actAsPlayerId },
        select: { id: true, isAppAdmin: true }
      });
    } else {
      currentPlayer = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: { id: true, isAppAdmin: true }
      });
    }

    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Only App Admins can merge players
    if (!currentPlayer.isAppAdmin) {
      return NextResponse.json({ error: 'Access denied. App Admin required.' }, { status: 403 });
    }

    const body = await req.json();
    const { primaryPlayerId, secondaryPlayerId } = body;

    if (!primaryPlayerId || !secondaryPlayerId) {
      return NextResponse.json(
        { error: 'Both primaryPlayerId and secondaryPlayerId are required' },
        { status: 400 }
      );
    }

    if (primaryPlayerId === secondaryPlayerId) {
      return NextResponse.json(
        { error: 'Cannot merge a player with themselves' },
        { status: 400 }
      );
    }

    // Verify both players exist
    const [primaryPlayer, secondaryPlayer] = await Promise.all([
      prisma.player.findUnique({ where: { id: primaryPlayerId } }),
      prisma.player.findUnique({ where: { id: secondaryPlayerId } }),
    ]);

    if (!primaryPlayer) {
      return NextResponse.json({ error: 'Primary player not found' }, { status: 404 });
    }

    if (!secondaryPlayer) {
      return NextResponse.json({ error: 'Secondary player not found' }, { status: 404 });
    }

    // Perform the merge in a transaction
    let mergedCount = 0;

    await prisma.$transaction(async (tx) => {
      // 1. Transfer tournament registrations
      // First, check for duplicate registrations (same tournament)
      const secondaryRegistrations = await tx.tournamentRegistration.findMany({
        where: { playerId: secondaryPlayerId },
        select: { tournamentId: true, id: true },
      });

      const primaryRegistrations = await tx.tournamentRegistration.findMany({
        where: {
          playerId: primaryPlayerId,
          tournamentId: { in: secondaryRegistrations.map(r => r.tournamentId) }
        },
        select: { tournamentId: true },
      });

      const primaryTournamentIds = new Set(primaryRegistrations.map(r => r.tournamentId));

      // Delete duplicate registrations from secondary player
      const duplicateRegIds = secondaryRegistrations
        .filter(r => primaryTournamentIds.has(r.tournamentId))
        .map(r => r.id);

      if (duplicateRegIds.length > 0) {
        await tx.tournamentRegistration.deleteMany({
          where: { id: { in: duplicateRegIds } },
        });
      }

      // Transfer non-duplicate registrations
      const transferableRegIds = secondaryRegistrations
        .filter(r => !primaryTournamentIds.has(r.tournamentId))
        .map(r => r.id);

      if (transferableRegIds.length > 0) {
        const updateResult = await tx.tournamentRegistration.updateMany({
          where: { id: { in: transferableRegIds } },
          data: { playerId: primaryPlayerId },
        });
        mergedCount += updateResult.count;
      }

      // 2. Transfer team memberships (TeamPlayer)
      // Check for duplicates (same team)
      const secondaryTeamPlayers = await tx.teamPlayer.findMany({
        where: { playerId: secondaryPlayerId },
        select: { teamId: true, playerId: true },
      });

      const primaryTeamPlayers = await tx.teamPlayer.findMany({
        where: {
          playerId: primaryPlayerId,
          teamId: { in: secondaryTeamPlayers.map(tp => tp.teamId) }
        },
        select: { teamId: true },
      });

      const primaryTeamIds = new Set(primaryTeamPlayers.map(tp => tp.teamId));

      // Delete duplicate team memberships
      const duplicateTeamPlayerIds = secondaryTeamPlayers
        .filter(tp => primaryTeamIds.has(tp.teamId))
        .map(tp => ({ teamId: tp.teamId, playerId: secondaryPlayerId }));

      for (const { teamId, playerId } of duplicateTeamPlayerIds) {
        await tx.teamPlayer.delete({
          where: { teamId_playerId: { teamId, playerId } },
        });
      }

      // Transfer non-duplicate team memberships
      const transferableTeamPlayers = secondaryTeamPlayers
        .filter(tp => !primaryTeamIds.has(tp.teamId));

      for (const tp of transferableTeamPlayers) {
        await tx.teamPlayer.update({
          where: { teamId_playerId: { teamId: tp.teamId, playerId: secondaryPlayerId } },
          data: { playerId: primaryPlayerId },
        });
        mergedCount++;
      }

      // 3. Transfer tournament invitations received
      // Check for duplicates (same tournament)
      const secondaryInvites = await tx.tournamentInvite.findMany({
        where: { playerId: secondaryPlayerId },
        select: { tournamentId: true, id: true },
      });

      const primaryInvites = await tx.tournamentInvite.findMany({
        where: {
          playerId: primaryPlayerId,
          tournamentId: { in: secondaryInvites.map(i => i.tournamentId) }
        },
        select: { tournamentId: true },
      });

      const primaryInviteTournamentIds = new Set(primaryInvites.map(i => i.tournamentId));

      // Delete duplicate invitations
      const duplicateInviteIds = secondaryInvites
        .filter(i => primaryInviteTournamentIds.has(i.tournamentId))
        .map(i => i.id);

      if (duplicateInviteIds.length > 0) {
        await tx.tournamentInvite.deleteMany({
          where: { id: { in: duplicateInviteIds } },
        });
      }

      // Transfer non-duplicate invitations
      const transferableInviteIds = secondaryInvites
        .filter(i => !primaryInviteTournamentIds.has(i.tournamentId))
        .map(i => i.id);

      if (transferableInviteIds.length > 0) {
        const updateResult = await tx.tournamentInvite.updateMany({
          where: { id: { in: transferableInviteIds } },
          data: { playerId: primaryPlayerId },
        });
        mergedCount += updateResult.count;
      }

      // 4. Transfer invite requests sent
      // Check for duplicates (same tournament)
      const secondaryRequests = await tx.inviteRequest.findMany({
        where: { playerId: secondaryPlayerId },
        select: { tournamentId: true, id: true },
      });

      const primaryRequests = await tx.inviteRequest.findMany({
        where: {
          playerId: primaryPlayerId,
          tournamentId: { in: secondaryRequests.map(r => r.tournamentId) }
        },
        select: { tournamentId: true },
      });

      const primaryRequestTournamentIds = new Set(primaryRequests.map(r => r.tournamentId));

      // Delete duplicate invite requests
      const duplicateRequestIds = secondaryRequests
        .filter(r => primaryRequestTournamentIds.has(r.tournamentId))
        .map(r => r.id);

      if (duplicateRequestIds.length > 0) {
        await tx.inviteRequest.deleteMany({
          where: { id: { in: duplicateRequestIds } },
        });
      }

      // Transfer non-duplicate requests
      const transferableRequestIds = secondaryRequests
        .filter(r => !primaryRequestTournamentIds.has(r.tournamentId))
        .map(r => r.id);

      if (transferableRequestIds.length > 0) {
        const updateResult = await tx.inviteRequest.updateMany({
          where: { id: { in: transferableRequestIds } },
          data: { playerId: primaryPlayerId },
        });
        mergedCount += updateResult.count;
      }

      // 5. Transfer waitlist entries
      // Check for duplicates (same tournament)
      const secondaryWaitlist = await tx.tournamentWaitlist.findMany({
        where: { playerId: secondaryPlayerId },
        select: { tournamentId: true, id: true },
      });

      const primaryWaitlist = await tx.tournamentWaitlist.findMany({
        where: {
          playerId: primaryPlayerId,
          tournamentId: { in: secondaryWaitlist.map(w => w.tournamentId) }
        },
        select: { tournamentId: true },
      });

      const primaryWaitlistTournamentIds = new Set(primaryWaitlist.map(w => w.tournamentId));

      // Delete duplicate waitlist entries
      const duplicateWaitlistIds = secondaryWaitlist
        .filter(w => primaryWaitlistTournamentIds.has(w.tournamentId))
        .map(w => w.id);

      if (duplicateWaitlistIds.length > 0) {
        await tx.tournamentWaitlist.deleteMany({
          where: { id: { in: duplicateWaitlistIds } },
        });
      }

      // Transfer non-duplicate waitlist entries
      const transferableWaitlistIds = secondaryWaitlist
        .filter(w => !primaryWaitlistTournamentIds.has(w.tournamentId))
        .map(w => w.id);

      if (transferableWaitlistIds.length > 0) {
        const updateResult = await tx.tournamentWaitlist.updateMany({
          where: { id: { in: transferableWaitlistIds } },
          data: { playerId: primaryPlayerId },
        });
        mergedCount += updateResult.count;
      }

      // 6. Transfer lineup entries (as player 1)
      const lineupP1Result = await tx.lineupEntry.updateMany({
        where: { player1Id: secondaryPlayerId },
        data: { player1Id: primaryPlayerId },
      });
      mergedCount += lineupP1Result.count;

      // Transfer lineup entries (as player 2)
      const lineupP2Result = await tx.lineupEntry.updateMany({
        where: { player2Id: secondaryPlayerId },
        data: { player2Id: primaryPlayerId },
      });
      mergedCount += lineupP2Result.count;

      // 7. Transfer team captain roles
      const captainResult = await tx.team.updateMany({
        where: { captainId: secondaryPlayerId },
        data: { captainId: primaryPlayerId },
      });
      mergedCount += captainResult.count;

      // 8. Transfer tournament admin roles
      // Check for duplicates (same tournament)
      const secondaryAdminRoles = await tx.tournamentAdmin.findMany({
        where: { playerId: secondaryPlayerId },
        select: { tournamentId: true, playerId: true },
      });

      const primaryAdminRoles = await tx.tournamentAdmin.findMany({
        where: {
          playerId: primaryPlayerId,
          tournamentId: { in: secondaryAdminRoles.map(a => a.tournamentId) }
        },
        select: { tournamentId: true },
      });

      const primaryAdminTournamentIds = new Set(primaryAdminRoles.map(a => a.tournamentId));

      // Delete duplicate admin roles
      const duplicateAdminRoles = secondaryAdminRoles
        .filter(a => primaryAdminTournamentIds.has(a.tournamentId))
        .map(a => ({ tournamentId: a.tournamentId, playerId: secondaryPlayerId }));

      for (const { tournamentId, playerId } of duplicateAdminRoles) {
        await tx.tournamentAdmin.delete({
          where: { tournamentId_playerId: { tournamentId, playerId } },
        });
      }

      // Transfer non-duplicate admin roles
      const transferableAdminRoles = secondaryAdminRoles
        .filter(a => !primaryAdminTournamentIds.has(a.tournamentId));

      for (const ar of transferableAdminRoles) {
        await tx.tournamentAdmin.update({
          where: { tournamentId_playerId: { tournamentId: ar.tournamentId, playerId: secondaryPlayerId } },
          data: { playerId: primaryPlayerId },
        });
        mergedCount++;
      }

      // 9. Transfer captain invites, stop roster links, tournament captains, etc.
      const captainInviteResult = await tx.captainInvite.updateMany({
        where: { playerId: secondaryPlayerId },
        data: { playerId: primaryPlayerId },
      });
      mergedCount += captainInviteResult.count;

      const stopRosterResult = await tx.stopTeamPlayer.updateMany({
        where: { playerId: secondaryPlayerId },
        data: { playerId: primaryPlayerId },
      });
      mergedCount += stopRosterResult.count;

      const tournamentCaptainResult = await tx.tournamentCaptain.updateMany({
        where: { playerId: secondaryPlayerId },
        data: { playerId: primaryPlayerId },
      });
      mergedCount += tournamentCaptainResult.count;

      const eventManagerResult = await tx.tournamentEventManager.updateMany({
        where: { playerId: secondaryPlayerId },
        data: { playerId: primaryPlayerId },
      });
      mergedCount += eventManagerResult.count;

      // 10. Disable the secondary player
      await tx.player.update({
        where: { id: secondaryPlayerId },
        data: {
          disabled: true,
          disabledAt: new Date(),
          disabledBy: currentPlayer.id,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Players merged successfully',
      mergedCount,
      primaryPlayerId,
      secondaryPlayerId,
    });
  } catch (error) {
    console.error('Error merging players:', error);
    return NextResponse.json(
      { error: 'Failed to merge players' },
      { status: 500 }
    );
  }
}
