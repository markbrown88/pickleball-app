import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe/config';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 *
 * This endpoint receives events from Stripe about payment status changes.
 * It must be registered in the Stripe dashboard.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  console.log('Received Stripe event:', event.type);

  try {
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Error handling webhook event:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing checkout.session.completed:', session.id);

  const registrationId = session.metadata?.registrationId || session.client_reference_id;

  if (!registrationId) {
    console.error('No registration ID found in session metadata');
    return;
  }

  // Get payment intent ID from session
  const paymentIntentId = session.payment_intent as string | null;

  // Update registration status using TournamentRegistration model
  await prisma.tournamentRegistration.update({
    where: { id: registrationId },
    data: {
      status: 'REGISTERED',
      paymentStatus: 'PAID',
      paymentId: paymentIntentId || undefined,
    },
  });

  // Update notes to include paymentIntentId if not already stored
  const registrationForNotes = await prisma.tournamentRegistration.findUnique({
    where: { id: registrationId },
    select: { notes: true },
  });

  if (registrationForNotes?.notes && paymentIntentId) {
    try {
      const notes = JSON.parse(registrationForNotes.notes);
      if (!notes.paymentIntentId) {
        notes.paymentIntentId = paymentIntentId;
        await prisma.tournamentRegistration.update({
          where: { id: registrationId },
          data: { notes: JSON.stringify(notes) },
        });
      }
    } catch (e) {
      console.error('Failed to update notes with paymentIntentId:', e);
    }
  }

  // Fetch registration with player and tournament details for email
  const registration = await prisma.tournamentRegistration.findUnique({
    where: { id: registrationId },
    include: {
      player: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          name: true,
        },
      },
      tournament: {
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
      },
    },
  });

  // Send payment receipt email
  if (registration?.player?.email && registration.tournament) {
    try {
      const playerName =
        registration.player.name ||
        (registration.player.firstName && registration.player.lastName
          ? `${registration.player.firstName} ${registration.player.lastName}`
          : registration.player.firstName || 'Player');

      const firstStop = registration.tournament.stops?.[0];
      const location = firstStop?.club
        ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
            .filter(Boolean)
            .join(', ')
        : null;

      const { sendPaymentReceiptEmail } = await import('@/server/email');
      await sendPaymentReceiptEmail({
        to: registration.player.email,
        playerName,
        tournamentName: registration.tournament.name,
        tournamentId: registration.tournamentId,
        amountPaid: registration.amountPaid || 0,
        paymentDate: new Date(),
        transactionId: session.payment_intent as string,
        startDate: firstStop?.startAt || null,
        endDate: firstStop?.endAt || null,
        location,
      });

      console.log(`Payment receipt email sent for registration ${registrationId}`);
    } catch (emailError) {
      console.error('Failed to send payment receipt email:', emailError);
    }
  }

  console.log(`Registration ${registrationId} marked as PAID`);
}

/**
 * Handle expired checkout session
 */
async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  console.log('Processing checkout.session.expired:', session.id);

  const registrationId = session.metadata?.registrationId || session.client_reference_id;

  if (!registrationId) {
    console.error('No registration ID found in session metadata');
    return;
  }

  // Mark registration as expired using TournamentRegistration model
  await prisma.tournamentRegistration.update({
    where: { id: registrationId },
    data: {
      paymentStatus: 'FAILED',
    },
  });

  // Fetch registration with player and tournament details for email
  const registration = await prisma.tournamentRegistration.findUnique({
    where: { id: registrationId },
    include: {
      player: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          name: true,
        },
      },
      tournament: {
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
      },
    },
  });

  // Send payment failed email
  if (registration?.player?.email && registration.tournament) {
    try {
      const playerName =
        registration.player.name ||
        (registration.player.firstName && registration.player.lastName
          ? `${registration.player.firstName} ${registration.player.lastName}`
          : registration.player.firstName || 'Player');

      const firstStop = registration.tournament.stops?.[0];
      const location = firstStop?.club
        ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
            .filter(Boolean)
            .join(', ')
        : null;

      const { sendPaymentFailedEmail } = await import('@/server/email');
      await sendPaymentFailedEmail({
        to: registration.player.email,
        playerName,
        tournamentName: registration.tournament.name,
        tournamentId: registration.tournamentId,
        amount: registration.amountPaid || 0,
        failureReason: 'Payment session expired. Please try again.',
        startDate: firstStop?.startAt || null,
        endDate: firstStop?.endAt || null,
        location,
      });

      console.log(`Payment failed email sent for registration ${registrationId}`);
    } catch (emailError) {
      console.error('Failed to send payment failed email:', emailError);
    }
  }

  console.log(`Registration ${registrationId} checkout session expired`);
}

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing payment_intent.succeeded:', paymentIntent.id);

  // First try to find registration by paymentIntentId stored in notes
  let registration = await prisma.tournamentRegistration.findFirst({
    where: {
      notes: {
        contains: paymentIntent.id,
      },
      paymentStatus: {
        in: ['PENDING', 'PAID'],
      },
    },
    include: {
      player: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          name: true,
        },
      },
      tournament: {
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
      },
    },
  });

  // Fallback: Find by matching amount and recent registrations (for backwards compatibility)
  if (!registration) {
    registration = await prisma.tournamentRegistration.findFirst({
      where: {
        paymentStatus: 'PENDING',
        amountPaid: paymentIntent.amount,
        registeredAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
        },
      },
      include: {
        player: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            name: true,
          },
        },
        tournament: {
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
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });
  }

  if (!registration) {
    console.log('No matching registration found for payment intent:', paymentIntent.id);
    return;
  }

  // Check if already paid (to avoid duplicate emails)
  const wasAlreadyPaid = registration.paymentStatus === 'PAID';

  // Ensure registration is marked as paid and paymentIntentId is stored
  await prisma.tournamentRegistration.update({
    where: { id: registration.id },
    data: {
      status: 'REGISTERED',
      paymentStatus: 'PAID',
      paymentId: paymentIntent.id,
    },
  });

  // Update notes to include paymentIntentId if not already stored
  if (registration.notes) {
    try {
      const notes = JSON.parse(registration.notes);
      if (!notes.paymentIntentId) {
        notes.paymentIntentId = paymentIntent.id;
        await prisma.tournamentRegistration.update({
          where: { id: registration.id },
          data: { notes: JSON.stringify(notes) },
        });
      }
    } catch (e) {
      console.error('Failed to update notes with paymentIntentId:', e);
    }
  }

  // Send payment receipt email if not already sent
  if (!wasAlreadyPaid && registration.player?.email && registration.tournament) {
    try {
      const playerName =
        registration.player.name ||
        (registration.player.firstName && registration.player.lastName
          ? `${registration.player.firstName} ${registration.player.lastName}`
          : registration.player.firstName || 'Player');

      const firstStop = registration.tournament.stops?.[0];
      const location = firstStop?.club
        ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
            .filter(Boolean)
            .join(', ')
        : null;

      const { sendPaymentReceiptEmail } = await import('@/server/email');
      await sendPaymentReceiptEmail({
        to: registration.player.email,
        playerName,
        tournamentName: registration.tournament.name,
        tournamentId: registration.tournamentId,
        amountPaid: registration.amountPaid || 0,
        paymentDate: new Date(),
        transactionId: paymentIntent.id,
        startDate: firstStop?.startAt || null,
        endDate: firstStop?.endAt || null,
        location,
      });

      console.log(`Payment receipt email sent for registration ${registration.id}`);
    } catch (emailError) {
      console.error('Failed to send payment receipt email:', emailError);
    }
  }

  console.log(`Payment confirmed for registration ${registration.id}`);
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing payment_intent.payment_failed:', paymentIntent.id);

  // Find registration by matching amount and recent registrations
  const registration = await prisma.tournamentRegistration.findFirst({
    where: {
      paymentStatus: 'PENDING',
      amountPaid: paymentIntent.amount,
      registeredAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
      },
    },
    include: {
      player: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          name: true,
        },
      },
      tournament: {
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
      },
    },
    orderBy: {
      registeredAt: 'desc',
    },
  });

  if (!registration) {
    console.log('No matching registration found for payment intent:', paymentIntent.id);
    return;
  }

  // Mark registration as failed
  await prisma.tournamentRegistration.update({
    where: { id: registration.id },
    data: {
      paymentStatus: 'FAILED',
    },
  });

  // Send payment failed email
  if (registration.player?.email && registration.tournament) {
    try {
      const playerName =
        registration.player.name ||
        (registration.player.firstName && registration.player.lastName
          ? `${registration.player.firstName} ${registration.player.lastName}`
          : registration.player.firstName || 'Player');

      const firstStop = registration.tournament.stops?.[0];
      const location = firstStop?.club
        ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
            .filter(Boolean)
            .join(', ')
        : null;

      const failureReason = paymentIntent.last_payment_error?.message || 'Payment could not be processed';

      const { sendPaymentFailedEmail } = await import('@/server/email');
      await sendPaymentFailedEmail({
        to: registration.player.email,
        playerName,
        tournamentName: registration.tournament.name,
        tournamentId: registration.tournamentId,
        amount: registration.amountPaid || 0,
        failureReason,
        startDate: firstStop?.startAt || null,
        endDate: firstStop?.endAt || null,
        location,
      });

      console.log(`Payment failed email sent for registration ${registration.id}`);
    } catch (emailError) {
      console.error('Failed to send payment failed email:', emailError);
    }
  }

  console.log(`Payment failed for registration ${registration.id}`);
}

/**
 * Handle refunded charge
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log('Processing charge.refunded:', charge.id);

  if (!charge.payment_intent) {
    console.error('No payment intent ID in refunded charge');
    return;
  }

  // Find registration by matching refund amount and recent paid registrations
  const registration = await prisma.tournamentRegistration.findFirst({
    where: {
      paymentStatus: 'PAID',
      amountPaid: charge.amount_refunded || charge.amount,
      registeredAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Within last 30 days
      },
    },
    include: {
      player: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          name: true,
        },
      },
      tournament: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      registeredAt: 'desc',
    },
  });

  if (!registration) {
    console.log('No matching registration found for refunded charge:', charge.id);
    return;
  }

  // Update registration status
  await prisma.tournamentRegistration.update({
    where: { id: registration.id },
    data: {
      status: 'WITHDRAWN',
      paymentStatus: 'REFUNDED',
      refundId: charge.id,
    },
  });

  // Send refund confirmation email
  if (registration.player?.email && registration.tournament) {
    try {
      const playerName =
        registration.player.name ||
        (registration.player.firstName && registration.player.lastName
          ? `${registration.player.firstName} ${registration.player.lastName}`
          : registration.player.firstName || 'Player');

      const refundAmount = charge.amount_refunded || charge.amount;

      const { sendRefundConfirmationEmail } = await import('@/server/email');
      await sendRefundConfirmationEmail({
        to: registration.player.email,
        playerName,
        tournamentName: registration.tournament.name,
        tournamentId: registration.tournamentId,
        refundAmount,
        refundDate: new Date(),
        transactionId: charge.id,
        reason: 'Refund processed',
      });

      console.log(`Refund confirmation email sent for registration ${registration.id}`);
    } catch (emailError) {
      console.error('Failed to send refund confirmation email:', emailError);
    }
  }

  console.log(`Registration ${registration.id} refunded`);
}
