import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe, STRIPE_CONFIG, formatAmountForStripe, formatAmountFromStripe } from '@/lib/stripe/config';
import { calculateRegistrationAmount } from '@/lib/payments/calculateAmount';
import { paymentRetryLimiter, getClientIp, checkRateLimit } from '@/lib/rateLimit';

/**
 * POST /api/payments/retry
 * Retry payment for an existing registration
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting to prevent retry abuse
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(paymentRetryLimiter, clientIp);
    
    if (rateLimitResult && !rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Too many retry attempts',
          details: 'Please wait before retrying payment.',
          retryAfter: rateLimitResult.reset,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { registrationId } = body;

    if (!registrationId) {
      return NextResponse.json(
        { 
          error: 'Registration ID is required',
          details: 'Please provide a valid registration ID to retry payment.',
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
            registrationCost: true,
            type: true,
            registrationType: true,
            brackets: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json(
        { 
          error: 'Registration not found',
          details: 'The registration you are trying to pay for could not be found.',
          supportUrl: '/support',
        },
        { status: 404 }
      );
    }

    // Check if registration is eligible for retry
    if (registration.paymentStatus === 'PAID' || registration.paymentStatus === 'COMPLETED') {
      return NextResponse.json(
        { 
          error: 'Registration already paid',
          details: 'This registration has already been paid. No retry needed.',
          registrationId: registrationId,
        },
        { status: 400 }
      );
    }

    // Check if tournament is still accepting registrations
    if (registration.tournament.registrationType === 'FREE') {
      return NextResponse.json(
        { 
          error: 'Free tournament',
          details: 'This tournament is free and does not require payment.',
        },
        { status: 400 }
      );
    }

    // Parse registration details from notes field
    let registrationDetails: {
      stopIds?: string[];
      brackets?: Array<{ stopId: string; bracketId: string; gameTypes?: string[] }>;
      clubId?: string;
      playerInfo?: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
      };
      expectedAmount?: number;
      pricingModel?: string;
    } = {};

    if (registration.notes) {
      try {
        registrationDetails = JSON.parse(registration.notes);
      } catch (e) {
        console.error('Failed to parse registration notes:', e);
      }
    }

    // Use pricingModel from notes if available, otherwise default to PER_TOURNAMENT
    const pricingModel = registrationDetails.pricingModel || 'PER_TOURNAMENT';
    const tournamentWithPricing = {
      ...registration.tournament,
      pricingModel,
    };
    
    // Calculate total amount based on pricing model
    const calculatedAmount = calculateRegistrationAmount(
      tournamentWithPricing,
      registrationDetails
    );

    // Validate amount matches what was stored during registration
    const storedAmountInDollars = registration.amountPaid ? formatAmountFromStripe(registration.amountPaid) : 0;
    const expectedAmount = registrationDetails.expectedAmount ?? storedAmountInDollars;
    
    if (Math.abs(calculatedAmount - expectedAmount) > 0.01 && expectedAmount > 0) {
      console.error('Amount mismatch on retry:', {
        calculated: calculatedAmount,
        expected: expectedAmount,
        stored: storedAmountInDollars,
        registrationId: registrationId,
      });
      return NextResponse.json(
        { 
          error: 'Payment amount validation failed',
          details: 'The calculated payment amount does not match the registration amount. This may indicate a pricing change. Please contact support for assistance.',
          supportUrl: '/support',
          registrationId: registrationId,
        },
        { status: 400 }
      );
    }

    const amount = calculatedAmount;

    if (amount <= 0) {
      return NextResponse.json(
        { 
          error: 'Invalid registration amount',
          details: 'The registration amount is invalid. Please contact support.',
          supportUrl: '/support',
        },
        { status: 400 }
      );
    }

    // Create line items for Stripe Checkout
    const lineItems = createLineItems(
      tournamentWithPricing,
      registration.tournament.brackets || [],
      registrationDetails,
      amount,
      registration.player
    );

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: STRIPE_CONFIG.checkout.paymentMethodTypes,
      mode: STRIPE_CONFIG.checkout.mode,
      line_items: lineItems,
      success_url: STRIPE_CONFIG.checkout.successUrl(
        registration.tournamentId,
        '{CHECKOUT_SESSION_ID}'
      ),
      cancel_url: STRIPE_CONFIG.checkout.cancelUrl(registration.tournamentId),
      customer_email: registration.player.email || undefined,
      metadata: {
        registrationId: registration.id,
        tournamentId: registration.tournamentId,
        tournamentName: registration.tournament.name,
        expectedAmount: amount.toString(),
        amountPaid: registration.amountPaid?.toString() || '0',
        isRetry: 'true', // Mark as retry
      },
      client_reference_id: registrationId,
    });

    // Update registration notes to include new Stripe session ID and reset payment status
    const updatedNotes = {
      ...registrationDetails,
      stripeSessionId: session.id,
      paymentIntentId: session.payment_intent as string | undefined,
      retryAttempts: ((registrationDetails as any).retryAttempts || 0) + 1,
      lastRetryAt: new Date().toISOString(),
    };

    await prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: {
        notes: JSON.stringify(updatedNotes),
        paymentStatus: 'PENDING', // Reset to pending for retry
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      isRetry: true,
    });

  } catch (error) {
    console.error('Payment retry error:', error);
    
    let errorMessage = 'Failed to retry payment';
    let errorDetails = '';
    
    if (error instanceof Error) {
      if (error.message.includes('No such registration')) {
        errorMessage = 'Registration not found';
        errorDetails = 'The registration you are trying to pay for could not be found.';
      } else if (error.message.includes('amount')) {
        errorMessage = 'Invalid payment amount';
        errorDetails = 'There was an issue calculating the payment amount. Please contact support.';
      } else if (error.message.includes('Stripe')) {
        errorMessage = 'Payment service error';
        errorDetails = 'We encountered an issue with our payment processor. Please try again in a moment.';
      } else {
        errorDetails = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        supportUrl: '/support',
      },
      { status: 500 }
    );
  }
}

/**
 * Create line items for Stripe Checkout (shared with create-checkout-session)
 */
function createLineItems(
  tournament: {
    id: string;
    name: string;
    registrationCost: number | null;
    pricingModel: string | null;
  },
  brackets: Array<{ id: string; name: string }>,
  registrationDetails: {
    stopIds?: string[];
    brackets?: Array<{ stopId: string; bracketId: string; gameTypes?: string[] }>;
  },
  totalAmount: number,
  player: {
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  }
): any[] {
  const playerName =
    player.name ||
    (player.firstName && player.lastName
      ? `${player.firstName} ${player.lastName}`
      : player.firstName || 'Player');

  const pricingModel = tournament.pricingModel || 'PER_TOURNAMENT';
  const bracketMap = new Map(brackets.map(b => [b.id, b.name]));

  if (pricingModel === 'PER_TOURNAMENT' || pricingModel === 'PER_STOP') {
    return [
      {
        price_data: {
          currency: STRIPE_CONFIG.currency,
          product_data: {
            name: `${tournament.name} - Registration`,
            description: `Tournament registration for ${playerName}`,
          },
          unit_amount: formatAmountForStripe(totalAmount),
        },
        quantity: 1,
      },
    ];
  }

  const lineItems: any[] = [];

  if (pricingModel === 'PER_BRACKET' && registrationDetails.brackets) {
    const uniqueBrackets = new Map<string, string>();
    
    registrationDetails.brackets.forEach((b) => {
      if (!uniqueBrackets.has(b.bracketId)) {
        const bracketName = bracketMap.get(b.bracketId) || `Bracket ${b.bracketId.slice(0, 8)}`;
        uniqueBrackets.set(b.bracketId, bracketName);
      }
    });

    for (const [bracketId, bracketName] of uniqueBrackets.entries()) {
      lineItems.push({
        price_data: {
          currency: STRIPE_CONFIG.currency,
          product_data: {
            name: `${tournament.name} - ${bracketName}`,
            description: `Bracket registration`,
          },
          unit_amount: formatAmountForStripe(tournament.registrationCost || 0),
        },
        quantity: 1,
      });
    }
  }

  if (pricingModel === 'PER_GAME_TYPE' && registrationDetails.brackets) {
    for (const bracket of registrationDetails.brackets) {
      const bracketName = bracketMap.get(bracket.bracketId) || `Bracket ${bracket.bracketId.slice(0, 8)}`;
      const gameTypes = (bracket as any).gameTypes || [];
      for (const gameType of gameTypes) {
        lineItems.push({
          price_data: {
            currency: STRIPE_CONFIG.currency,
            product_data: {
              name: `${tournament.name} - ${formatGameType(gameType)}`,
              description: `${bracketName} registration`,
            },
            unit_amount: formatAmountForStripe(tournament.registrationCost || 0),
          },
          quantity: 1,
        });
      }
    }
  }

  return lineItems.length > 0 ? lineItems : [
    {
      price_data: {
        currency: STRIPE_CONFIG.currency,
        product_data: {
          name: `${tournament.name} - Registration`,
          description: `Tournament registration for ${playerName}`,
        },
        unit_amount: formatAmountForStripe(totalAmount),
      },
      quantity: 1,
    },
  ];
}

function formatGameType(gameType: string): string {
  const gameTypeMap: Record<string, string> = {
    MENS_DOUBLES: "Men's Doubles",
    WOMENS_DOUBLES: "Women's Doubles",
    MIXED_DOUBLES: "Mixed Doubles",
    MIXED_DOUBLES_1: "Mixed Doubles 1",
    MIXED_DOUBLES_2: "Mixed Doubles 2",
    MENS_SINGLES: "Men's Singles",
    WOMENS_SINGLES: "Women's Singles",
  };
  return gameTypeMap[gameType] || gameType;
}

