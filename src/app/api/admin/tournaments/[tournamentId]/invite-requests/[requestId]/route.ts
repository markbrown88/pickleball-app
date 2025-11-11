import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/admin/tournaments/[tournamentId]/invite-requests/[requestId]
 * Approve or reject an invite request
 */
export async function PATCH(
  req: Request,
  props: { params: Promise<{ tournamentId: string; requestId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tournamentId, requestId } = await props.params;
    const body = await req.json();
    const { action } = body; // 'approve' or 'reject'

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Verify user is admin of this tournament
    const admin = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin profile not found' }, { status: 404 });
    }

    const isAdmin = await prisma.tournamentAdmin.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId: admin.id,
        },
      },
    });

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'You are not an admin of this tournament' },
        { status: 403 }
      );
    }

    // Get the invite request
    const inviteRequest = await prisma.inviteRequest.findUnique({
      where: { id: requestId },
      include: {
        player: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            registrationType: true,
            registrationCost: true,
          },
        },
      },
    });

    if (!inviteRequest) {
      return NextResponse.json({ error: 'Invite request not found' }, { status: 404 });
    }

    if (inviteRequest.tournamentId !== tournamentId) {
      return NextResponse.json(
        { error: 'Invite request does not belong to this tournament' },
        { status: 400 }
      );
    }

    if (inviteRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Invite request already ${inviteRequest.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Approve the request - update status to ACCEPTED
      await prisma.inviteRequest.update({
        where: { id: requestId },
        data: {
          status: 'ACCEPTED',
          reviewedAt: new Date(),
          reviewedBy: admin.id,
        },
      });

      // Create a tournament invite for this player
      await prisma.tournamentInvite.create({
        data: {
          tournamentId,
          playerId: inviteRequest.playerId,
          invitedBy: admin.id,
          status: 'ACCEPTED', // Auto-accept since they requested it
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          acceptedAt: new Date(),
          respondedAt: new Date(),
        },
      });

      // Automatically create registration for the player
      await prisma.tournamentRegistration.create({
        data: {
          tournamentId,
          playerId: inviteRequest.playerId,
          status: 'REGISTERED',
          paymentStatus:
            inviteRequest.tournament.registrationType === 'FREE' ? 'PAID' : 'PENDING',
          amountPaid: inviteRequest.tournament.registrationType === 'FREE' ? 0 : null,
        },
      });

      // Send confirmation email to player
      if (inviteRequest.player.email) {
        const playerName =
          inviteRequest.player.name ||
          (inviteRequest.player.firstName && inviteRequest.player.lastName
            ? `${inviteRequest.player.firstName} ${inviteRequest.player.lastName}`
            : inviteRequest.player.firstName || 'Player');

        try {
          const { sendRegistrationConfirmationEmail } = await import('@/server/email');

          // Get tournament details for email
          const tournamentDetails = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
              stops: {
                take: 1,
                orderBy: { startAt: 'asc' },
                select: {
                  startAt: true,
                  endAt: true,
                  club: { select: { name: true, city: true, region: true } },
                },
              },
            },
          });

          if (tournamentDetails) {
            const firstStop = tournamentDetails.stops[0];
            const location = firstStop?.club
              ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
                  .filter(Boolean)
                  .join(', ')
              : null;

            await sendRegistrationConfirmationEmail({
              to: inviteRequest.player.email,
              playerName,
              tournamentName: inviteRequest.tournament.name,
              tournamentId,
              startDate: firstStop?.startAt || null,
              endDate: firstStop?.endAt || null,
              location,
              isPaid: inviteRequest.tournament.registrationType === 'FREE',
              amountPaid: inviteRequest.tournament.registrationType === 'FREE' ? 0 : null,
              registrationDate: new Date(),
            });
          }
        } catch (emailError) {
          console.error('Failed to send registration confirmation email:', emailError);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Invite request approved and player registered',
        status: 'ACCEPTED',
      });
    } else {
      // Reject the request
      await prisma.inviteRequest.update({
        where: { id: requestId },
        data: {
          status: 'DECLINED',
          reviewedAt: new Date(),
          reviewedBy: admin.id,
        },
      });

      // Send rejection email to player
      if (inviteRequest.player.email) {
        const playerName =
          inviteRequest.player.name ||
          (inviteRequest.player.firstName && inviteRequest.player.lastName
            ? `${inviteRequest.player.firstName} ${inviteRequest.player.lastName}`
            : inviteRequest.player.firstName || 'Player');

        try {
          const { sendRejectionEmail } = await import('@/server/email');
          await sendRejectionEmail({
            to: inviteRequest.player.email,
            playerName,
            tournamentName: inviteRequest.tournament.name,
            tournamentId: tournamentId,
            reason: 'Your invite request was declined by the tournament administrator.',
            wasRefunded: false,
            refundAmount: null,
          });

          console.log('Rejection email sent to player');
        } catch (emailError) {
          console.error('Failed to send rejection email:', emailError);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Invite request rejected',
        status: 'DECLINED',
      });
    }
  } catch (error) {
    console.error('Error processing invite request:', error);
    return NextResponse.json(
      { error: 'Failed to process invite request' },
      { status: 500 }
    );
  }
}
