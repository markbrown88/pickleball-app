import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/admin/tournaments/[tournamentId]/registrations/[registrationId]/reject
 * Reject a player's registration with a reason
 * Body: { reason: string }
 */
export async function PATCH(
  req: Request,
  props: { params: Promise<{ tournamentId: string; registrationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tournamentId, registrationId } = await props.params;
    const body = await req.json();
    const { reason } = body;

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
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

    // Get registration with player and tournament details
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
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
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (registration.tournamentId !== tournamentId) {
      return NextResponse.json(
        { error: 'Registration does not belong to this tournament' },
        { status: 400 }
      );
    }

    if (registration.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Registration is already rejected' },
        { status: 400 }
      );
    }

    // Calculate refund amount if they paid
    const wasRefunded = registration.paymentStatus === 'PAID' &&
                       registration.amountPaid &&
                       registration.amountPaid > 0;
    const refundAmount = wasRefunded ? registration.amountPaid : null;

    // Update registration to rejected
    await prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: admin.id,
        rejectionReason: reason.trim(),
        // TODO: Update paymentStatus to REFUNDED if paid
      },
    });

    // Send rejection email to player
    if (registration.player.email) {
      const playerName =
        registration.player.name ||
        (registration.player.firstName && registration.player.lastName
          ? `${registration.player.firstName} ${registration.player.lastName}`
          : registration.player.firstName || 'Player');

      try {
        const { sendRejectionEmail } = await import('@/server/email');

        await sendRejectionEmail({
          to: registration.player.email,
          playerName,
          tournamentName: registration.tournament.name,
          tournamentId,
          reason: reason.trim(),
          wasRefunded: wasRefunded || false,
          refundAmount,
        });
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Registration rejected successfully',
    });
  } catch (error) {
    console.error('Error rejecting registration:', error);
    return NextResponse.json(
      { error: 'Failed to reject registration' },
      { status: 500 }
    );
  }
}
