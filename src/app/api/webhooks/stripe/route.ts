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

  // Fetch registration with player and tournament details
  const registration = await prisma.tournamentRegistration.findUnique({
    where: { id: registrationId },
    include: {
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
    },
  });

  // Create roster entries for paid team tournaments after payment confirmation
  if (registration?.player && registration.tournament) {
    try {
      // Parse registration notes to get stopIds, brackets, and clubId
      let notes: any = {};
      if (registration.notes) {
        try {
          notes = JSON.parse(registration.notes);
        } catch (e) {
          console.error('Failed to parse registration notes for roster creation:', e);
        }
      }

      const stopIds: string[] = notes.stopIds || [];
      const brackets: Array<{ stopId: string; bracketId: string; gameTypes: string[] }> = notes.brackets || [];
      const clubId: string | null = notes.clubId || null;

      // Check if this is a team tournament
      const { isTeamTournament } = await import('@/lib/tournamentTypeConfig');
      const tournamentIsTeam = isTeamTournament(registration.tournament.type);

      if (tournamentIsTeam && clubId && stopIds.length > 0 && brackets.length > 0) {
        // Get tournament brackets and club info
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

        // Create roster entries for each stop/bracket combination
        for (const stopId of stopIds) {
          // Find the bracket selection for this stop
          const bracketSelection = brackets.find((sb: any) => sb && sb.stopId === stopId);
          if (!bracketSelection || !bracketSelection.bracketId) {
            console.warn(`No bracket selection found for stop ${stopId} in registration ${registrationId}`);
            continue;
          }

          const bracketId = bracketSelection.bracketId;
          const bracket = tournamentBrackets.find((b) => b.id === bracketId);
          if (!bracket) {
            console.warn(`Bracket ${bracketId} not found for tournament ${registration.tournamentId}`);
            continue;
          }

          // Find or create team for this club and bracket
          let team = await prisma.team.findFirst({
            where: {
              tournamentId: registration.tournamentId,
              clubId: clubId,
              bracketId: bracketId,
            },
          });

          if (!team) {
            const teamName = bracket.name === 'DEFAULT' ? clubName : `${clubName} ${bracket.name}`;
            team = await prisma.team.create({
              data: {
                name: teamName,
                tournamentId: registration.tournamentId,
                clubId: clubId,
                bracketId: bracketId,
              },
            });
          }

          // Create StopTeamPlayer entry (roster entry)
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
              },
              update: {}, // No update needed if exists
            });
            console.log(`Created roster entry for stop ${stopId}, team ${team.id}, player ${registration.playerId}`);
          } catch (rosterError) {
            console.error(`Failed to create roster entry for stop ${stopId}, team ${team.id}, player ${registration.playerId}:`, rosterError);
            // Don't throw - roster creation failure shouldn't fail payment processing
          }
        }
      }
    } catch (rosterCreationError) {
      console.error('Error creating roster entries after payment:', rosterCreationError);
      // Don't throw - roster creation failure shouldn't fail payment processing
    }
  }

  // Send payment receipt email
  if (registration?.player?.email && registration.tournament) {
    try {
      const playerName =
        registration.player.name ||
        (registration.player.firstName && registration.player.lastName
          ? `${registration.player.firstName} ${registration.player.lastName}`
          : registration.player.firstName || 'Player');

      // Get actual stops from registration notes
      let notes: any = {};
      if (registration.notes) {
        try {
          notes = JSON.parse(registration.notes);
        } catch (e) {
          // Ignore parse errors
        }
      }

      const stopIds: string[] = notes.stopIds || [];
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

      if (stopIds.length > 0) {
        // Fetch stops with club information
        const fetchedStops = await prisma.stop.findMany({
          where: { id: { in: stopIds } },
          include: {
            club: {
              select: {
                name: true,
                address1: true,
                city: true,
                region: true,
                postalCode: true,
              },
            },
          },
        });

        // Get bracket names from roster entries if they exist
        const rosterEntries = await prisma.stopTeamPlayer.findMany({
          where: {
            stopId: { in: stopIds },
            playerId: registration.playerId,
          },
          include: {
            team: {
              include: {
                bracket: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });

        // Create a map of stopId -> bracketName from roster entries
        const bracketMap = new Map<string, string>();
        for (const roster of rosterEntries) {
          if (roster.team?.bracket?.name) {
            bracketMap.set(roster.stopId, roster.team.bracket.name);
          }
        }

        // Build stops array
        stops = fetchedStops.map((stop) => ({
          id: stop.id,
          name: stop.name,
          startAt: stop.startAt,
          endAt: stop.endAt,
          bracketName: bracketMap.get(stop.id) || null,
          club: stop.club ? {
            name: stop.club.name,
            address1: stop.club.address1,
            city: stop.club.city,
            region: stop.club.region,
            postalCode: stop.club.postalCode,
          } : null,
        }));
      }

      // Fallback to first stop for backward compatibility
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
        startDate: stops.length > 0 ? stops[0]?.startAt || null : (firstStop?.startAt || null),
        endDate: stops.length > 0 ? stops[stops.length - 1]?.endAt || null : (firstStop?.endAt || null),
        location: stops.length > 0 ? null : location,
        stops: stops.length > 0 ? stops : undefined,
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

  // Create roster entries for paid team tournaments after payment confirmation
  if (registration?.player && registration.tournament && !wasAlreadyPaid) {
    try {
      // Parse registration notes to get stopIds, brackets, and clubId
      let notes: any = {};
      if (registration.notes) {
        try {
          notes = JSON.parse(registration.notes);
        } catch (e) {
          console.error('Failed to parse registration notes for roster creation:', e);
        }
      }

      const stopIds: string[] = notes.stopIds || [];
      const brackets: Array<{ stopId: string; bracketId: string; gameTypes: string[] }> = notes.brackets || [];
      const clubId: string | null = notes.clubId || null;

      // Check if this is a team tournament
      const { isTeamTournament } = await import('@/lib/tournamentTypeConfig');
      const tournamentIsTeam = isTeamTournament(registration.tournament.type);

      if (tournamentIsTeam && clubId && stopIds.length > 0 && brackets.length > 0) {
        // Get tournament brackets and club info
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

        // Create roster entries for each stop/bracket combination
        for (const stopId of stopIds) {
          // Find the bracket selection for this stop
          const bracketSelection = brackets.find((sb: any) => sb && sb.stopId === stopId);
          if (!bracketSelection || !bracketSelection.bracketId) {
            console.warn(`No bracket selection found for stop ${stopId} in registration ${registration.id}`);
            continue;
          }

          const bracketId = bracketSelection.bracketId;
          const bracket = tournamentBrackets.find((b) => b.id === bracketId);
          if (!bracket) {
            console.warn(`Bracket ${bracketId} not found for tournament ${registration.tournamentId}`);
            continue;
          }

          // Find or create team for this club and bracket
          let team = await prisma.team.findFirst({
            where: {
              tournamentId: registration.tournamentId,
              clubId: clubId,
              bracketId: bracketId,
            },
          });

          if (!team) {
            const teamName = bracket.name === 'DEFAULT' ? clubName : `${clubName} ${bracket.name}`;
            team = await prisma.team.create({
              data: {
                name: teamName,
                tournamentId: registration.tournamentId,
                clubId: clubId,
                bracketId: bracketId,
              },
            });
          }

          // Create StopTeamPlayer entry (roster entry)
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
              },
              update: {}, // No update needed if exists
            });
            console.log(`Created roster entry for stop ${stopId}, team ${team.id}, player ${registration.playerId}`);
          } catch (rosterError) {
            console.error(`Failed to create roster entry for stop ${stopId}, team ${team.id}, player ${registration.playerId}:`, rosterError);
            // Don't throw - roster creation failure shouldn't fail payment processing
          }
        }
      }
    } catch (rosterCreationError) {
      console.error('Error creating roster entries after payment:', rosterCreationError);
      // Don't throw - roster creation failure shouldn't fail payment processing
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

      // Get actual stops from registration notes
      let notes: any = {};
      if (registration.notes) {
        try {
          notes = JSON.parse(registration.notes);
        } catch (e) {
          // Ignore parse errors
        }
      }

      const stopIds: string[] = notes.stopIds || [];
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

      if (stopIds.length > 0) {
        // Fetch stops with club information
        const fetchedStops = await prisma.stop.findMany({
          where: { id: { in: stopIds } },
          include: {
            club: {
              select: {
                name: true,
                address1: true,
                city: true,
                region: true,
                postalCode: true,
              },
            },
          },
        });

        // Get bracket names from roster entries if they exist
        const rosterEntries = await prisma.stopTeamPlayer.findMany({
          where: {
            stopId: { in: stopIds },
            playerId: registration.playerId,
          },
          include: {
            team: {
              include: {
                bracket: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });

        // Create a map of stopId -> bracketName from roster entries
        const bracketMap = new Map<string, string>();
        for (const roster of rosterEntries) {
          if (roster.team?.bracket?.name) {
            bracketMap.set(roster.stopId, roster.team.bracket.name);
          }
        }

        // Build stops array
        stops = fetchedStops.map((stop) => ({
          id: stop.id,
          name: stop.name,
          startAt: stop.startAt,
          endAt: stop.endAt,
          bracketName: bracketMap.get(stop.id) || null,
          club: stop.club ? {
            name: stop.club.name,
            address1: stop.club.address1,
            city: stop.club.city,
            region: stop.club.region,
            postalCode: stop.club.postalCode,
          } : null,
        }));
      }

      // Fallback to first stop for backward compatibility
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
        startDate: stops.length > 0 ? stops[0]?.startAt || null : (firstStop?.startAt || null),
        endDate: stops.length > 0 ? stops[stops.length - 1]?.endAt || null : (firstStop?.endAt || null),
        location: stops.length > 0 ? null : location,
        stops: stops.length > 0 ? stops : undefined,
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
