import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe/config';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { isTeamTournament } from '@/lib/tournamentTypeConfig';
import {
  appendPaidStops,
  appendRefund,
  getPaidBracketsForCurrentPayment,
  getPaidStopIdsForCurrentPayment,
  getPendingPaymentAmountInCents,
  markPaymentProcessed,
  parseRegistrationNotes,
  stringifyRegistrationNotes,
} from '@/lib/payments/registrationNotes';
import type { RegistrationNotes } from '@/lib/payments/registrationNotes';
import {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail
} from '@/server/email_subscription';

const registrationInclude = {
  player: {
    select: {
      id: true,
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
      type: true,
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
} as const;

// Disable body parsing for webhook - we need raw body for signature verification
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    console.error('[Webhook] Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // Log webhook secret info (first few chars only for security)
  const secretPrefix = process.env.STRIPE_WEBHOOK_SECRET.substring(0, 10);

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', {
      error: err.message,
      errorType: err.type,
      secretPrefix: secretPrefix,
      signatureLength: signature?.length,
      bodyLength: body.length,
      bodyPreview: body.substring(0, 100),
    });

    // Provide helpful error message
    const errorMessage = err.message || 'Unknown signature verification error';
    return NextResponse.json(
      {
        error: 'Invalid signature',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        hint: 'Check that STRIPE_WEBHOOK_SECRET matches the webhook secret from Stripe Dashboard',
      },
      { status: 400 }
    );
  }


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

      // Subscription Events
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
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
  const paymentIntentId = session.payment_intent as string | null;

  if (!paymentIntentId) {
    console.warn('Checkout session completed without payment intent reference', {
      sessionId: session.id,
    });
    return;
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    await handlePaymentIntentSucceeded(paymentIntent);
  } catch (error) {
    console.error('Failed to process checkout.session.completed event:', error);
  }
}

/**
 * Handle expired checkout session
 */
async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {

  const registrationId = session.metadata?.registrationId || session.client_reference_id;

  if (!registrationId) {
    console.error('No registration ID found in session metadata');
    return;
  }

  // First check if payment was already processed (race condition protection)
  const existingRegistration = await prisma.tournamentRegistration.findUnique({
    where: { id: registrationId },
    select: { paymentStatus: true, notes: true }
  });

  // Don't overwrite if already paid or if processedPayments exist in notes
  if (existingRegistration?.paymentStatus === 'PAID') {
    console.log(`[Webhook] Session expired but registration ${registrationId} already PAID - skipping`);
    return;
  }

  // Also check notes for processed payments (extra safety)
  if (existingRegistration?.notes) {
    try {
      const notes = JSON.parse(existingRegistration.notes);
      if (notes.processedPayments && notes.processedPayments.length > 0) {
        console.log(`[Webhook] Session expired but registration ${registrationId} has processed payments - skipping`);
        return;
      }
    } catch (e) {
      // Notes not valid JSON, continue with expiry
    }
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
      const notes = parseRegistrationNotes(registration.notes ?? null);
      const amount = getPendingPaymentAmountInCents(notes, 0);
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
        amount,
        failureReason: 'Payment session expired. Please try again.',
        startDate: firstStop?.startAt || null,
        endDate: firstStop?.endAt || null,
        location,
      });

    } catch (emailError) {
      console.error('Failed to send payment failed email:', emailError);
    }
  }

}

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const registration = await findRegistrationForPaymentIntent(paymentIntent);

  if (!registration) {
    return;
  }

  const notes = parseRegistrationNotes(registration.notes ?? null);

  if (notes.processedPayments?.some((entry) => entry.paymentIntentId === paymentIntent.id)) {
    return;
  }

  const paidStopIds = getPaidStopIdsForCurrentPayment(notes);
  const paidBrackets = getPaidBracketsForCurrentPayment(notes);
  const notesWithPayment = markPaymentProcessed(
    notes,
    paymentIntent.id,
    paymentIntent.amount,
    'payment_intent'
  );
  const updatedNotes = appendPaidStops(notesWithPayment, paymentIntent.id, paidStopIds);
  const updatedNotesString = stringifyRegistrationNotes(updatedNotes);
  const newAmountPaid = (registration.amountPaid || 0) + paymentIntent.amount;

  const updatedRegistration = await prisma.tournamentRegistration.update({
    where: { id: registration.id },
    data: {
      status: 'REGISTERED',
      paymentStatus: 'PAID',
      paymentId: paymentIntent.id,
      amountPaid: newAmountPaid,
      notes: updatedNotesString,
    },
    include: registrationInclude,
  });

  await createRosterEntriesForStops(
    updatedRegistration,
    paidStopIds,
    paidBrackets,
    updatedNotes.clubId || null
  );

  await sendPaymentReceiptIfPossible(
    updatedRegistration,
    paymentIntent.amount,
    paymentIntent.id,
    paidStopIds,
    updatedNotes
  );
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {

  const registration = await findRegistrationForPaymentIntent(paymentIntent);

  if (!registration) {
    return;
  }

  // Mark registration as failed
  if (registration.paymentStatus !== 'PAID') {
    await prisma.tournamentRegistration.update({
      where: { id: registration.id },
      data: {
        paymentStatus: 'FAILED',
      },
    });
  }

  // Send payment failed email
  if (!registration.player?.email || !registration.tournament) {
    return;
  }

  const notes = parseRegistrationNotes(registration.notes ?? null);
  const amount = paymentIntent.amount || getPendingPaymentAmountInCents(notes, 0);
  const playerName =
    registration.player.name ||
    (registration.player.firstName && registration.player.lastName
      ? `${registration.player.firstName} ${registration.player.lastName}`
      : registration.player.firstName || 'Player');
  const firstStop = registration.tournament.stops?.[0];
  const location = firstStop?.club
    ? [firstStop.club.name, firstStop.club.city, firstStop.club.region].filter(Boolean).join(', ')
    : null;
  const failureReason =
    paymentIntent.last_payment_error?.message || 'Payment could not be processed';

  try {
    const { sendPaymentFailedEmail } = await import('@/server/email');
    await sendPaymentFailedEmail({
      to: registration.player.email,
      playerName,
      tournamentName: registration.tournament.name,
      tournamentId: registration.tournamentId,
      amount,
      failureReason,
      startDate: firstStop?.startAt || null,
      endDate: firstStop?.endAt || null,
      location,
    });
  } catch (emailError) {
    console.error('Failed to send payment failed email:', emailError);
  }
}

/**
 * Handle refunded charge
 */
async function handleChargeRefunded(charge: Stripe.Charge) {

  if (!charge.payment_intent) {
    console.error('No payment intent ID in refunded charge');
    return;
  }

  const registration = await findRegistrationByPaymentIntentId(
    charge.payment_intent as string
  );

  if (!registration) {
    return;
  }

  const refundAmount = charge.amount_refunded || charge.amount;
  const remainingAmount = Math.max((registration.amountPaid || 0) - refundAmount, 0);
  const refundReason = charge.refunds?.data?.[0]?.reason;
  const updatedNotes = appendRefund(
    parseRegistrationNotes(registration.notes ?? null),
    charge.id,
    refundAmount,
    refundReason || undefined
  );

  await prisma.tournamentRegistration.update({
    where: { id: registration.id },
    data: {
      status: remainingAmount > 0 ? registration.status : 'WITHDRAWN',
      paymentStatus: remainingAmount > 0 ? 'PAID' : 'REFUNDED',
      refundId: charge.id,
      amountPaid: remainingAmount,
      notes: stringifyRegistrationNotes(updatedNotes),
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

    } catch (emailError) {
      console.error('Failed to send refund confirmation email:', emailError);
    }
  }

}

async function findRegistrationForPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const metadataRegistrationId =
    paymentIntent.metadata?.registrationId ||
    paymentIntent.metadata?.registration_id ||
    paymentIntent.metadata?.REGISTRATION_ID;

  if (metadataRegistrationId) {
    const registrationFromMetadata = await prisma.tournamentRegistration.findUnique({
      where: { id: metadataRegistrationId },
      include: registrationInclude,
    });

    if (registrationFromMetadata) {
      return registrationFromMetadata;
    }
  }

  const registrationByPaymentId = await findRegistrationByPaymentIntentId(paymentIntent.id);
  if (registrationByPaymentId) {
    return registrationByPaymentId;
  }

  try {
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntent.id,
      limit: 1,
    });

    if (sessions.data.length > 0) {
      const session = sessions.data[0];
      const sessionRegistrationId = session.metadata?.registrationId || session.client_reference_id;

      if (sessionRegistrationId) {
        const registrationFromSession = await prisma.tournamentRegistration.findUnique({
          where: { id: sessionRegistrationId },
          include: registrationInclude,
        });

        if (registrationFromSession) {
          return registrationFromSession;
        }
      }
    }
  } catch (sessionError) {
    console.warn('Could not retrieve checkout session:', sessionError);
  }

  return prisma.tournamentRegistration.findFirst({
    where: {
      paymentStatus: 'PENDING',
      registeredAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    include: registrationInclude,
    orderBy: {
      registeredAt: 'desc',
    },
  });
}

async function findRegistrationByPaymentIntentId(paymentIntentId: string) {
  return prisma.tournamentRegistration.findFirst({
    where: {
      OR: [
        { paymentId: paymentIntentId },
        {
          notes: {
            contains: paymentIntentId,
          },
        },
      ],
    },
    include: registrationInclude,
  });
}

async function createRosterEntriesForStops(
  registration: Awaited<ReturnType<typeof findRegistrationForPaymentIntent>>,
  paidStopIds: string[],
  paidBrackets: Array<{ stopId: string; bracketId: string; gameTypes?: string[] }>,
  clubId: string | null
) {
  if (
    !registration ||
    !paidStopIds.length ||
    !paidBrackets.length ||
    !clubId ||
    !isTeamTournament(registration.tournament.type)
  ) {
    return;
  }

  const [tournamentBrackets, club] = await Promise.all([
    prisma.tournamentBracket.findMany({
      where: { tournamentId: registration.tournamentId },
      select: { id: true, name: true },
    }),
    prisma.club.findUnique({
      where: { id: clubId },
      select: { name: true },
    }),
  ]);

  const clubName = club?.name || 'Team';
  const stops = await prisma.stop.findMany({
    where: { id: { in: paidStopIds } },
    select: { id: true, name: true, startAt: true, endAt: true },
  });

  const now = new Date();

  for (const stopId of paidStopIds) {
    const stop = stops.find((s) => s.id === stopId);
    if (stop) {
      const isPast = stop.endAt
        ? new Date(stop.endAt) < now
        : stop.startAt
          ? new Date(stop.startAt) < now
          : false;
      if (isPast) {
        continue;
      }
    }

    const bracketSelection = paidBrackets.find((bracket) => bracket.stopId === stopId);
    if (!bracketSelection?.bracketId) {
      continue;
    }

    const bracket = tournamentBrackets.find((b) => b.id === bracketSelection.bracketId);
    if (!bracket) {
      continue;
    }

    let team = await prisma.team.findFirst({
      where: {
        tournamentId: registration.tournamentId,
        clubId,
        bracketId: bracketSelection.bracketId,
      },
    });

    if (!team) {
      const teamName = bracket.name === 'DEFAULT' ? clubName : `${clubName} ${bracket.name}`;
      team = await prisma.team.create({
        data: {
          name: teamName,
          tournamentId: registration.tournamentId,
          clubId,
          bracketId: bracketSelection.bracketId,
        },
      });
    }

    try {
      await prisma.stopTeamPlayer.upsert({
        where: {
          stopId_teamId_playerId: {
            stopId,
            teamId: team.id,
            playerId: registration.playerId,
          },
        },
        create: {
          stopId,
          teamId: team.id,
          playerId: registration.playerId,
          paymentMethod: 'STRIPE',
        },
        update: {
          paymentMethod: 'STRIPE',
        },
      });
    } catch (rosterError) {
      console.error(
        `Failed to create roster entry for stop ${stopId}, team ${team.id}, player ${registration.playerId}:`,
        rosterError
      );
    }
  }
}

async function sendPaymentReceiptIfPossible(
  registration: Awaited<ReturnType<typeof findRegistrationForPaymentIntent>>,
  amountInCents: number,
  transactionId: string,
  paidStopIds: string[],
  notes: RegistrationNotes
) {
  if (!registration?.player?.email || !registration.tournament) {
    return;
  }

  const playerName =
    registration.player.name ||
    (registration.player.firstName && registration.player.lastName
      ? `${registration.player.firstName} ${registration.player.lastName}`
      : registration.player.firstName || 'Player');

  const stopIdsForEmail =
    paidStopIds.length > 0 ? paidStopIds : notes.stopIds ? Array.from(new Set(notes.stopIds)) : [];

  let stops: Array<{
    id: string;
    name: string;
    startAt: Date | null;
    endAt: Date | null;
    bracketName?: string | null;
    club?: {
      name: string;
      address1?: string | null;
      city?: string | null;
      region?: string | null;
      postalCode?: string | null;
    } | null;
  }> = [];

  if (stopIdsForEmail.length > 0) {
    const fetchedStops = await prisma.stop.findMany({
      where: { id: { in: stopIdsForEmail } },
      include: {
        club: {
          select: {
            name: true,
            address: true,
            address1: true,
            city: true,
            region: true,
            postalCode: true,
          },
        },
      },
    });

    const rosterEntries = await prisma.stopTeamPlayer.findMany({
      where: {
        stopId: { in: stopIdsForEmail },
        playerId: registration.playerId,
      },
      include: {
        team: {
          include: {
            bracket: {
              select: { name: true },
            },
          },
        },
      },
    });

    const bracketMap = new Map<string, string>();
    for (const roster of rosterEntries) {
      if (roster.team?.bracket?.name) {
        bracketMap.set(roster.stopId, roster.team.bracket.name);
      }
    }

    stops = fetchedStops.map((stop) => ({
      id: stop.id,
      name: stop.name,
      startAt: stop.startAt,
      endAt: stop.endAt,
      bracketName: bracketMap.get(stop.id) || null,
      club: stop.club
        ? {
          name: stop.club.name,
          address: stop.club.address,
          address1: stop.club.address1,
          city: stop.club.city,
          region: stop.club.region,
          postalCode: stop.club.postalCode,
        }
        : null,
    }));
  }

  const firstStop = registration.tournament.stops?.[0];
  const location = firstStop?.club
    ? [firstStop.club.name, firstStop.club.city, firstStop.club.region].filter(Boolean).join(', ')
    : null;

  let clubName: string | null = null;
  if (notes.clubId) {
    try {
      const club = await prisma.club.findUnique({
        where: { id: notes.clubId },
        select: { name: true },
      });
      clubName = club?.name || null;
    } catch (error) {
      console.error('Failed to fetch club name for payment receipt email:', error);
    }
  }

  try {
    const { sendPaymentReceiptEmail } = await import('@/server/email');
    await sendPaymentReceiptEmail({
      to: registration.player.email,
      playerName,
      tournamentName: registration.tournament.name,
      tournamentId: registration.tournamentId,
      amountPaid: amountInCents,
      paymentDate: new Date(),
      transactionId,
      startDate: stops.length > 0 ? stops[0]?.startAt || null : firstStop?.startAt || null,
      endDate:
        stops.length > 0 ? stops[stops.length - 1]?.endAt || null : firstStop?.endAt || null,
      location: stops.length > 0 ? null : location,
      stops: stops.length > 0 ? stops : undefined,
      clubName,
    });
  } catch (emailError) {
    console.error('Failed to send payment receipt email:', emailError);
  }
}

/**
 * Handle new subscription creation
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const clubId = subscription.metadata?.clubId;

  if (!clubId) {
    console.error('Subscription created without clubId in metadata:', subscription.id);
    return;
  }

  await prisma.club.update({
    where: { id: clubId },
    data: {
      status: 'SUBSCRIBED',
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status.toUpperCase() as any,
    },
  });
}

/**
 * Handle subscription updates (renewals, cancellations, failed payments)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const clubId = subscription.metadata?.clubId;

  if (!clubId) {
    // Try to find club by subscription ID if metadata is missing
    const club = await prisma.club.findFirst({
      where: { subscriptionId: subscription.id },
      select: { id: true }
    });

    if (!club) return;
    return updateClubSubscription(club.id, subscription);
  }

  await updateClubSubscription(clubId, subscription);
}

/**
 * Handle subscription deletion (expiry/cancellation)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const clubId = subscription.metadata?.clubId;

  if (!clubId) {
    const club = await prisma.club.findFirst({
      where: { subscriptionId: subscription.id },
      select: { id: true }
    });

    if (!club) return;
    return downgradeClubToFree(club.id);
  }

  await downgradeClubToFree(clubId);
}

/**
 * Helper to update club based on subscription status
 */
async function updateClubSubscription(clubId: string, subscription: Stripe.Subscription) {
  const status = subscription.status;
  let clubStatus: 'SUBSCRIBED' | 'PAST_DUE' | 'ACTIVE' = 'SUBSCRIBED';

  // Map Stripe status to ClubStatus
  if (['active', 'trialing'].includes(status)) {
    clubStatus = 'SUBSCRIBED';
  } else if (['past_due', 'unpaid', 'incomplete'].includes(status)) {
    clubStatus = 'PAST_DUE';
  } else {
    clubStatus = 'ACTIVE'; // Fallback for canceled/ended
  }

  // Ensure subscriptionStatus enum matches what's in DB or cast to any if types are not generated
  await prisma.club.update({
    where: { id: clubId },
    data: {
      status: clubStatus,
      subscriptionId: subscription.id,
      subscriptionStatus: status.toUpperCase() as any,
    },
  });
}

/**
 * Helper to downgrade club when subscription ends
 */
async function downgradeClubToFree(clubId: string) {
  try {
    const club = await prisma.club.update({
      where: { id: clubId },
      data: {
        status: 'ACTIVE', // "ACTIVE" = Free Participating Club
        subscriptionStatus: 'CANCELED',
      },
      select: { email: true, name: true }
    });

    if (club.email) {
      await sendSubscriptionCancelledEmail(club.email, club.name);
    }
  } catch (e) {
    console.error('Failed to downgrade club', e);
  }
}

/**
 * Handle successful invoice payment (send receipt)
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subField = (invoice as any).subscription;
  // Only process subscription invoices
  if (!subField || invoice.amount_paid === 0) return;

  const subId = typeof subField === 'string' ? subField : subField.id;

  // Find club
  const club = await prisma.club.findFirst({
    where: { subscriptionId: subId },
    select: { id: true, email: true, name: true }
  });

  if (club?.email) {
    try {
      await sendPaymentSuccessEmail(
        club.email,
        club.name,
        invoice.amount_paid,
        new Date(invoice.created * 1000)
      );
    } catch (e) {
      console.error('Failed to send payment success email', e);
    }
  }
}

/**
 * Handle failed invoice payment (send warning)
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subField = (invoice as any).subscription;
  if (!subField) return;

  const subId = typeof subField === 'string' ? subField : subField.id;

  const club = await prisma.club.findFirst({
    where: { subscriptionId: subId },
    select: { id: true, email: true, name: true }
  });

  if (club?.email) {
    try {
      await sendPaymentFailedEmail(club.email, club.name);
    } catch (e) {
      console.error('Failed to send payment failed email', e);
    }
  }
}

