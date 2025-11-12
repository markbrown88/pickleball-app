import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe, STRIPE_CONFIG, formatAmountForStripe, formatAmountFromStripe } from '@/lib/stripe/config';
import { calculateRegistrationAmount } from '@/lib/payments/calculateAmount';
import { paymentCheckoutLimiter, getClientIp, checkRateLimit } from '@/lib/rateLimit';

/**
 * POST /api/payments/create-checkout-session
 * Create a Stripe Checkout session for tournament registration payment
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting to prevent payment spam
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(paymentCheckoutLimiter, clientIp);
    
    if (rateLimitResult && !rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Too many payment requests',
          details: 'Please wait before creating another payment session.',
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
          details: 'Please provide a valid registration ID to proceed with payment.',
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
            pricingModel: true,
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
    }) as any; // Temporary: Prisma client needs regeneration after schema update

    if (!registration) {
      return NextResponse.json(
        { 
          error: 'Registration not found',
          details: 'The registration you are trying to pay for could not be found. Please try registering again or contact support.',
          supportUrl: '/support',
        },
        { status: 404 }
      );
    }

    // Check if already paid
    if (registration.paymentStatus === 'PAID') {
      return NextResponse.json(
        { 
          error: 'Registration has already been paid',
          details: 'This registration has already been paid. If you believe this is an error, please contact support.',
          supportUrl: '/support',
          registrationId: registrationId,
        },
        { status: 400 }
      );
    }

    // Parse registration details from notes field
    let registrationDetails: {
      stopIds?: string[];
      brackets?: Array<{ stopId: string; bracketId: string }>;
      clubId?: string;
      playerInfo?: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
      };
      expectedAmount?: number; // Amount in dollars stored during registration
    } = {};

    if (registration.notes) {
      try {
        registrationDetails = JSON.parse(registration.notes);
      } catch (e) {
        console.error('Failed to parse registration notes:', e);
      }
    }

    // Calculate total amount based on pricing model
    // Prefer pricingModel from tournament (source of truth), then from notes, then default
    const pricingModel = registration.tournament.pricingModel 
      || (registrationDetails as any).pricingModel 
      || 'TOURNAMENT_WIDE';
    
    // Convert registrationCost from cents to dollars for calculation
    const registrationCostInDollars = registration.tournament.registrationCost 
      ? formatAmountFromStripe(registration.tournament.registrationCost) 
      : 0;
    
    const tournamentWithPricing = {
      ...registration.tournament,
      registrationCost: registrationCostInDollars,
      pricingModel,
    };
    
    console.log('Payment calculation debug:', {
      registrationId: registrationId,
      pricingModel,
      registrationCostInCents: registration.tournament.registrationCost,
      registrationCostInDollars,
      stopIds: registrationDetails.stopIds,
      brackets: registrationDetails.brackets,
    });
    
    const calculatedAmount = calculateRegistrationAmount(
      tournamentWithPricing,
      registrationDetails
    );

    // Validate amount matches what was stored during registration
    const storedAmountInDollars = registration.amountPaid ? formatAmountFromStripe(registration.amountPaid) : 0;
    const expectedAmount = registrationDetails.expectedAmount ?? storedAmountInDollars;
    
    console.log('Amount validation debug:', {
      registrationId: registrationId,
      calculatedAmount,
      expectedAmount,
      storedAmountInDollars,
      amountPaidInCents: registration.amountPaid,
      difference: Math.abs(calculatedAmount - expectedAmount),
    });
    
    if (Math.abs(calculatedAmount - expectedAmount) > 0.01) {
      console.error('Amount mismatch:', {
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
          details: 'The registration amount is invalid. This may be a free tournament or there may be an issue with pricing. Please contact support.',
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
        expectedAmount: amount.toString(), // Store amount for validation
        amountPaid: registration.amountPaid?.toString() || '0', // Store stored amount
      },
      client_reference_id: registrationId,
    });

    // Update registration notes to include Stripe session ID and payment intent ID
    const updatedNotes = {
      ...registrationDetails,
      stripeSessionId: session.id,
      paymentIntentId: session.payment_intent as string | undefined,
    };

    await prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: {
        notes: JSON.stringify(updatedNotes),
        paymentStatus: 'PENDING',
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Stripe checkout session creation error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create payment session';
    let errorDetails = '';
    
    if (error instanceof Error) {
      if (error.message.includes('No such registration')) {
        errorMessage = 'Registration not found';
        errorDetails = 'The registration you are trying to pay for could not be found. Please try registering again.';
      } else if (error.message.includes('amount')) {
        errorMessage = 'Invalid payment amount';
        errorDetails = 'There was an issue calculating the payment amount. Please contact support if this persists.';
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
 * Create line items for Stripe Checkout
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

  // Default to PER_TOURNAMENT if pricingModel not specified
  const pricingModel = tournament.pricingModel || 'PER_TOURNAMENT';

  // Create a map of bracket IDs to names for quick lookup
  const bracketMap = new Map(brackets.map(b => [b.id, b.name]));

  // For simple pricing models, create a single line item
  if (
    pricingModel === 'PER_TOURNAMENT' ||
    pricingModel === 'PER_STOP'
  ) {
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

  // For per-bracket or per-game-type, create detailed line items
  const lineItems: any[] = [];

  if (pricingModel === 'PER_BRACKET' && registrationDetails.brackets) {
    const uniqueBrackets = new Map<string, string>();
    
    // Get bracket names from database
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

/**
 * Format game type for display
 */
function formatGameType(gameType: string): string {
  const gameTypeMap: Record<string, string> = {
    MENS_DOUBLES: "Men's Doubles",
    WOMENS_DOUBLES: "Women's Doubles",
    MIXED_DOUBLES: 'Mixed Doubles',
    MIXED_DOUBLES_1: 'Mixed Doubles 1',
    MIXED_DOUBLES_2: 'Mixed Doubles 2',
    MENS_SINGLES: "Men's Singles",
    WOMENS_SINGLES: "Women's Singles",
  };

  return gameTypeMap[gameType] || gameType;
}
