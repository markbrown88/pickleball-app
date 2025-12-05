import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/config';
import { formatAmountFromStripe } from '@/lib/stripe/config';
import { refundLimiter, getClientIp, checkRateLimit } from '@/lib/rateLimit';
import type Stripe from 'stripe';
import {
  appendRefund,
  parseRegistrationNotes,
  stringifyRegistrationNotes,
} from '@/lib/payments/registrationNotes';

/**
 * POST /api/payments/refund
 * Process a refund for a paid registration (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting to prevent accidental mass refunds
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(refundLimiter, userId); // Limit by user ID for admin actions

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const body = await request.json();
    const { registrationId, reason, amount } = body;

    if (!registrationId) {
      return NextResponse.json(
        {
          error: 'Registration ID is required',
          details: 'Please provide a valid registration ID to process refund.',
        },
        { status: 400 }
      );
    }

    // Fetch registration with tournament and player details
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            registrationType: true,
            startDate: true,
            stops: {
              take: 1,
              orderBy: { startAt: 'asc' },
              select: {
                startAt: true,
              },
            },
          },
        },
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json(
        {
          error: 'Registration not found',
          details: 'The registration you are trying to refund could not be found.',
        },
        { status: 404 }
      );
    }

    // Check if registration is eligible for refund
    if (registration.paymentStatus === 'REFUNDED') {
      return NextResponse.json(
        {
          error: 'Already refunded',
          details: 'This registration has already been refunded.',
          registrationId: registrationId,
        },
        { status: 400 }
      );
    }

    if (registration.paymentStatus !== 'PAID' && registration.paymentStatus !== 'COMPLETED') {
      return NextResponse.json(
        {
          error: 'Registration not paid',
          details: 'This registration has not been paid and cannot be refunded.',
          registrationId: registrationId,
        },
        { status: 400 }
      );
    }

    // Check if tournament has started (no refunds after start)
    const tournamentStartDate = registration.tournament.startDate ||
      registration.tournament.stops[0]?.startAt;

    if (tournamentStartDate) {
      const now = new Date();
      const startDate = new Date(tournamentStartDate);
      const hoursUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilStart < 24) {
        return NextResponse.json(
          {
            error: 'Refund deadline passed',
            details: 'Refunds are only available more than 24 hours before tournament start.',
            tournamentStartDate: tournamentStartDate.toISOString(),
            hoursUntilStart: Math.round(hoursUntilStart),
          },
          { status: 400 }
        );
      }
    }

    // Get payment intent ID
    const paymentIntentId = registration.paymentId;
    if (!paymentIntentId) {
      return NextResponse.json(
        {
          error: 'No payment found',
          details: 'This registration does not have an associated payment that can be refunded.',
        },
        { status: 400 }
      );
    }

    // Calculate refund amount (full refund by default, or specified amount)
    const refundAmount = amount
      ? Math.round(amount * 100) // Convert dollars to cents
      : registration.amountPaid || 0;

    if (refundAmount <= 0) {
      return NextResponse.json(
        {
          error: 'Invalid refund amount',
          details: 'Refund amount must be greater than zero.',
        },
        { status: 400 }
      );
    }

    if (refundAmount > (registration.amountPaid || 0)) {
      return NextResponse.json(
        {
          error: 'Refund amount exceeds payment',
          details: `Cannot refund more than the original payment amount of $${formatAmountFromStripe(registration.amountPaid || 0).toFixed(2)}.`,
        },
        { status: 400 }
      );
    }

    // Process refund through Stripe
    let refund: Stripe.Refund;
    try {
      refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: refundAmount,
        reason: reason || 'requested_by_customer',
        metadata: {
          registrationId: registration.id,
          tournamentId: registration.tournamentId,
          refundedBy: userId,
          refundReason: reason || 'Admin refund',
        },
      });
    } catch (stripeError: any) {
      console.error('Stripe refund error:', stripeError);
      return NextResponse.json(
        {
          error: 'Refund processing failed',
          details: stripeError.message || 'Failed to process refund through payment processor.',
          stripeError: process.env.NODE_ENV === 'development' ? stripeError.message : undefined,
        },
        { status: 500 }
      );
    }

    const isFullRefund = refundAmount === (registration.amountPaid || 0);
    const remainingAmount = Math.max((registration.amountPaid || 0) - refundAmount, 0);
    const notesObject = appendRefund(
      parseRegistrationNotes(registration.notes ?? null),
      refund.id,
      refundAmount,
      reason
    );

    await prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: {
        paymentStatus: isFullRefund ? 'REFUNDED' : 'PAID', // Partial refunds keep status as PAID
        refundId: refund.id,
        status: isFullRefund ? 'WITHDRAWN' : registration.status, // Full refund = withdrawal
        amountPaid: remainingAmount,
        notes: stringifyRegistrationNotes(notesObject),
      },
    });

    // Send refund confirmation email
    try {
      const playerName =
        registration.player.name ||
        (registration.player.firstName && registration.player.lastName
          ? `${registration.player.firstName} ${registration.player.lastName}`
          : registration.player.firstName || 'Player');

      const { sendRefundConfirmationEmail } = await import('@/server/email');
      await sendRefundConfirmationEmail({
        to: registration.player.email || '',
        playerName,
        tournamentName: registration.tournament.name,
        tournamentId: registration.tournamentId,
        refundAmount: refundAmount,
        refundDate: new Date(),
        transactionId: refund.id,
        reason: reason || 'Refund processed',
      });
    } catch (emailError) {
      console.error('Failed to send refund confirmation email:', emailError);
      // Don't fail the refund if email fails
    }

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refundAmount,
        amountFormatted: `$${formatAmountFromStripe(refundAmount).toFixed(2)}`,
        isFullRefund,
        status: refund.status,
        registrationId: registration.id,
      },
    });

  } catch (error) {
    console.error('Refund processing error:', error);

    let errorMessage = 'Failed to process refund';
    let errorDetails = '';

    if (error instanceof Error) {
      errorDetails = error.message;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}

