export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';

type CtxPromise = { params: Promise<{ tournamentId: string }> };

/**
 * POST /api/player/tournaments/[tournamentId]/register
 * Register the current player for a tournament (supports Act As)
 */
export async function POST(req: NextRequest, ctx: CtxPromise) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tournamentId } = await ctx.params;

    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    let effectivePlayer;
    
    try {
      effectivePlayer = await getEffectivePlayer(actAsPlayerId);
    } catch (actAsError) {
      // If Act As fails, get the real player
      const realPlayer = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: { id: true }
      });
      
      if (!realPlayer) {
        return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
      }
      
      effectivePlayer = {
        realUserId: userId,
        realPlayerId: realPlayer.id,
        isActingAs: false,
        targetPlayerId: realPlayer.id,
        isAppAdmin: false
      };
    }

    // Use the effective player ID (either real or acting as)
    const playerId = effectivePlayer.targetPlayerId;

    // Get tournament with registration settings
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        registrationStatus: true,
        registrationType: true,
        registrationCost: true,
        maxPlayers: true,
        isWaitlistEnabled: true,
        _count: {
          select: {
            registrations: {
              where: {
                status: 'REGISTERED',
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if registration is open
    if (tournament.registrationStatus !== 'OPEN') {
      return NextResponse.json(
        { error: 'This tournament is not open for registration' },
        { status: 400 }
      );
    }

    // Check if already registered
    const existingRegistration = await prisma.tournamentRegistration.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId: tournament.id,
          playerId,
        },
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { error: 'You are already registered for this tournament' },
        { status: 400 }
      );
    }

    // Check if tournament is full
    const registeredCount = tournament._count.registrations;
    const isFull = tournament.maxPlayers !== null && registeredCount >= tournament.maxPlayers;

    if (isFull) {
      return NextResponse.json(
        {
          error: 'This tournament is full',
          waitlistAvailable: tournament.isWaitlistEnabled,
        },
        { status: 400 }
      );
    }

    // Create registration
    let registration;
    try {
      registration = await prisma.tournamentRegistration.create({
        data: {
          tournamentId: tournament.id,
          playerId,
          status: 'REGISTERED',
          paymentStatus: tournament.registrationType === 'FREE' ? 'PAID' : 'PENDING',
          amountPaid: tournament.registrationType === 'FREE' ? 0 : null,
        },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          registeredAt: true,
        },
      });
    } catch (dbError) {
      console.error('Database error creating registration:', dbError);
      throw dbError;
    }

    // Get player details for email
    const playerDetails = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        email: true,
        name: true,
        firstName: true,
        lastName: true,
      },
    });

    // Get tournament details for email
    const tournamentDetails = await prisma.tournament.findUnique({
      where: { id: tournament.id },
      include: {
        stops: {
          take: 1,
          orderBy: { startAt: 'asc' },
          select: {
            startAt: true,
            endAt: true,
            club: {
              select: {
                name: true,
                city: true,
                region: true,
              },
            },
          },
        },
      },
    }).catch(() => null);

    // Send confirmation email to player (non-blocking)
    if (playerDetails?.email && tournamentDetails) {
      try {

        const playerName =
          playerDetails.name ||
          (playerDetails.firstName && playerDetails.lastName
            ? `${playerDetails.firstName} ${playerDetails.lastName}`
            : playerDetails.firstName || 'Player');

        const firstStop = tournamentDetails.stops?.[0];
        const location = firstStop?.club
          ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
              .filter(Boolean)
              .join(', ')
          : null;

        const { sendRegistrationConfirmationEmail } = await import('@/server/email');
        await sendRegistrationConfirmationEmail({
          to: playerDetails.email,
          playerName,
          tournamentName: tournament.name,
          tournamentId: tournament.id,
          startDate: firstStop?.startAt || null,
          endDate: firstStop?.endAt || null,
          location,
          isPaid: tournament.registrationType === 'PAID',
          amountPaid: tournament.registrationType === 'PAID' ? tournament.registrationCost : 0,
          registrationDate: registration.registeredAt,
        });

      } catch (emailError) {
        console.error('[Registration] Failed to send confirmation email:', emailError);
        // Don't fail the registration if email fails
      }
    } else {
    }

    // Send notification email to tournament admins
    try {
      const admins = await prisma.tournamentAdmin.findMany({
        where: { tournamentId: tournament.id },
        include: {
          player: {
            select: {
              email: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (admins.length > 0 && playerDetails) {
        const { sendAdminNotificationEmail } = await import('@/server/email');
        const playerName =
          playerDetails.name ||
          (playerDetails.firstName && playerDetails.lastName
            ? `${playerDetails.firstName} ${playerDetails.lastName}`
            : playerDetails.firstName || 'Player');

        for (const admin of admins) {
          if (!admin.player.email) continue;

          const adminName =
            admin.player.name ||
            (admin.player.firstName && admin.player.lastName
              ? `${admin.player.firstName} ${admin.player.lastName}`
              : admin.player.firstName || 'Admin');

          try {
            await sendAdminNotificationEmail({
              to: admin.player.email,
              adminName,
              playerName,
              playerEmail: playerDetails.email || 'N/A',
              tournamentName: tournament.name,
              tournamentId: tournament.id,
              action: 'registered',
              isPaid: tournament.registrationType === 'PAID',
              amountPaid: tournament.registrationType === 'PAID' ? tournament.registrationCost : 0,
            });
          } catch (adminEmailError) {
            console.error(`Failed to send admin notification to ${admin.player.email}:`, adminEmailError);
          }
        }
      }
    } catch (adminError) {
      console.error('Failed to send admin notifications:', adminError);
      // Don't fail the registration if admin emails fail
    }

    // TODO: If PAID, return payment URL/info

    return NextResponse.json({
      success: true,
      registration: {
        id: registration.id,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        registeredAt: registration.registeredAt,
        requiresPayment: tournament.registrationType === 'PAID',
        amount: tournament.registrationCost,
      },
    });
  } catch (error) {
    console.error('Error registering for tournament:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Unknown';
    
    // Log full error details
    console.error('Error details:', { 
      errorName,
      errorMessage, 
      errorStack,
      error: error instanceof Error ? error.toString() : String(error)
    });
    
    // Log Prisma-specific error details
    if (error instanceof Error && 'code' in error) {
      console.error('Prisma error code:', (error as any).code);
      console.error('Prisma error meta:', (error as any).meta);
    }
    
    // Ensure we always return valid JSON
    try {
      return NextResponse.json(
        { 
          error: 'Failed to register for tournament',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          errorName: process.env.NODE_ENV === 'development' ? errorName : undefined,
        },
        { status: 500 }
      );
    } catch (jsonError) {
      // Fallback if JSON.stringify fails
      console.error('Failed to create error response:', jsonError);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to register for tournament' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
}

/**
 * DELETE /api/player/tournaments/[tournamentId]/register
 * Withdraw from a tournament (supports Act As)
 */
export async function DELETE(req: NextRequest, ctx: CtxPromise) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tournamentId } = await ctx.params;

    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    let effectivePlayer;
    
    try {
      effectivePlayer = await getEffectivePlayer(actAsPlayerId);
    } catch (actAsError) {
      // If Act As fails, get the real player
      const realPlayer = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: { id: true, email: true, name: true, firstName: true, lastName: true }
      });
      
      if (!realPlayer) {
        return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
      }
      
      effectivePlayer = {
        realUserId: userId,
        realPlayerId: realPlayer.id,
        isActingAs: false,
        targetPlayerId: realPlayer.id,
        isAppAdmin: false
      };
    }

    // Use the effective player ID (either real or acting as)
    const playerId = effectivePlayer.targetPlayerId;

    // Get player details for email
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Get registration
    const registration = await prisma.tournamentRegistration.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId,
        },
      },
      include: {
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
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    if (registration.status === 'WITHDRAWN') {
      return NextResponse.json(
        { error: 'Already withdrawn from this tournament' },
        { status: 400 }
      );
    }

    // Check if refund is needed
    const wasRefunded = registration.paymentStatus === 'PAID' && registration.amountPaid && registration.amountPaid > 0;
    const refundAmount = wasRefunded ? registration.amountPaid : null;

    // Update registration to withdrawn
    await prisma.tournamentRegistration.update({
      where: { id: registration.id },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
        // TODO: Update paymentStatus to REFUNDED if paid
      },
    });

    // Send withdrawal confirmation email to player
    if (player.email) {
      const playerName =
        player.name ||
        (player.firstName && player.lastName
          ? `${player.firstName} ${player.lastName}`
          : player.firstName || 'Player');

      try {
        const { sendWithdrawalConfirmationEmail } = await import('@/server/email');
        await sendWithdrawalConfirmationEmail({
          to: player.email,
          playerName,
          tournamentName: registration.tournament.name,
          tournamentId: registration.tournament.id,
          wasRefunded: wasRefunded || false,
          refundAmount,
        });
      } catch (emailError) {
        console.error('Failed to send withdrawal email:', emailError);
        // Don't fail the withdrawal if email fails
      }
    }

    // Send notification email to tournament admins
    try {
      const admins = await prisma.tournamentAdmin.findMany({
        where: { tournamentId },
        include: {
          player: {
            select: {
              email: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (admins.length > 0 && player.email) {
        const { sendAdminNotificationEmail } = await import('@/server/email');
        const playerName =
          player.name ||
          (player.firstName && player.lastName
            ? `${player.firstName} ${player.lastName}`
            : player.firstName || 'Player');

        for (const admin of admins) {
          if (!admin.player.email) continue;

          const adminName =
            admin.player.name ||
            (admin.player.firstName && admin.player.lastName
              ? `${admin.player.firstName} ${admin.player.lastName}`
              : admin.player.firstName || 'Admin');

          try {
            await sendAdminNotificationEmail({
              to: admin.player.email,
              adminName,
              playerName,
              playerEmail: player.email,
              tournamentName: registration.tournament.name,
              tournamentId: registration.tournament.id,
              action: 'cancelled',
              isPaid: wasRefunded || false,
              amountPaid: refundAmount,
            });
          } catch (adminEmailError) {
            console.error(`Failed to send admin notification to ${admin.player.email}:`, adminEmailError);
          }
        }
      }
    } catch (adminError) {
      console.error('Failed to send admin notifications:', adminError);
      // Don't fail the withdrawal if admin emails fail
    }

    // TODO: Process refund if paid via Stripe
    // TODO: Promote someone from waitlist if available

    return NextResponse.json({
      success: true,
      message: 'Successfully withdrawn from tournament',
    });
  } catch (error) {
    console.error('Error withdrawing from tournament:', error);
    return NextResponse.json(
      { error: 'Failed to withdraw from tournament' },
      { status: 500 }
    );
  }
}
