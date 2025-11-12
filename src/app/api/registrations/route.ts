import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { validateRegistration, sanitizeInput } from '@/lib/validation/registration';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';
import { calculateRegistrationAmount } from '@/lib/payments/calculateAmount';
import { calculateTotalWithTax } from '@/lib/payments/calculateTax';
import { formatAmountForStripe } from '@/lib/stripe/config';
import { isTeamTournament } from '@/lib/tournamentTypeConfig';

/**
 * POST /api/registrations
 * Create a new tournament registration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      tournamentId,
      playerInfo,
      selectedStopIds,
      selectedClubId,
      selectedBrackets,
    } = body;

    // Validate required fields
    if (!tournamentId || !playerInfo || !selectedStopIds || !selectedBrackets) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch tournament to check type and pricing
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        type: true,
        registrationStatus: true,
        registrationType: true,
        registrationCost: true,
        pricingModel: true,
        maxPlayers: true,
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    }) as any; // Temporary: Prisma client needs regeneration after schema update

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Check registration status
    if (tournament.registrationStatus !== 'OPEN') {
      return NextResponse.json(
        { error: 'Registration is not open for this tournament' },
        { status: 400 }
      );
    }

    // Check max players limit
    if (tournament.maxPlayers && tournament._count.registrations >= tournament.maxPlayers) {
      return NextResponse.json(
        { error: 'Tournament has reached maximum player capacity' },
        { status: 400 }
      );
    }

    // Validate registration data
    const tournamentIsTeam = isTeamTournament(tournament.type);
    const validationErrors = validateRegistration(
      playerInfo,
      selectedStopIds,
      selectedBrackets,
      tournamentIsTeam,
      selectedClubId
    );

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validationErrors },
        { status: 400 }
      );
    }

    // Sanitize player info
    const sanitizedPlayerInfo = {
      firstName: sanitizeInput(playerInfo.firstName),
      lastName: sanitizeInput(playerInfo.lastName),
      email: sanitizeInput(playerInfo.email).toLowerCase(),
      phone: playerInfo.phone.trim() ? sanitizeInput(playerInfo.phone) : null,
    };

    // Check for duplicate registration
    // For multi-stop tournaments, allow registration for different stops
    const existingPlayer = await prisma.player.findUnique({
      where: { email: sanitizedPlayerInfo.email },
    });

    if (existingPlayer) {
      const existingRegistrations = await prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,
          playerId: existingPlayer.id,
        },
        select: {
          id: true,
          notes: true,
        },
      });

      // Check if tournament has multiple stops
      const tournamentStops = await prisma.stop.findMany({
        where: { tournamentId },
        select: { id: true },
      });
      const hasMultipleStops = tournamentStops.length > 1;

      // If tournament has multiple stops, check for stop overlap
      // If single stop or no stops, block any duplicate registration
      if (hasMultipleStops) {
        // Check if any existing registration has overlapping stops
        for (const existingReg of existingRegistrations) {
          if (!existingReg.notes) {
            // Old registration format without stop info - block to be safe
            return NextResponse.json(
              { error: 'A registration with this email already exists for this tournament' },
              { status: 409 }
            );
          }
          
          try {
            const notes = JSON.parse(existingReg.notes);
            const existingStopIds: string[] = notes.stopIds || [];
            
            // If existing registration has no stops recorded, block to be safe
            if (existingStopIds.length === 0) {
              return NextResponse.json(
                { error: 'A registration with this email already exists for this tournament' },
                { status: 409 }
              );
            }
            
            // Check for overlap between existing stops and new stops
            const overlappingStops = selectedStopIds.filter((stopId: string) => existingStopIds.includes(stopId));
            
            if (overlappingStops.length > 0) {
              // Get stop names for better error message
              const overlappingStopNames = await prisma.stop.findMany({
                where: { id: { in: overlappingStops } },
                select: { name: true },
              });
              
              const stopNames = overlappingStopNames.map(s => s.name).join(', ');
              return NextResponse.json(
                { 
                  error: `You are already registered for ${overlappingStops.length === 1 ? 'stop' : 'stops'}: ${stopNames}. Please select different stops.`,
                  overlappingStops: overlappingStops,
                },
                { status: 409 }
              );
            }
            // No overlap - allow registration for different stops
          } catch (e) {
            // If notes can't be parsed, block to be safe
            console.warn(`Could not parse notes for registration ${existingReg.id}:`, e);
            return NextResponse.json(
              { error: 'A registration with this email already exists for this tournament' },
              { status: 409 }
            );
          }
        }
        // No overlapping stops found - allow registration
      } else {
        // Single stop or no stops - block duplicate registration (existing behavior)
        if (existingRegistrations.length > 0) {
          return NextResponse.json(
            { error: 'A registration with this email already exists for this tournament' },
            { status: 409 }
          );
        }
      }
    }

    // Get authenticated user if logged in
    const { userId } = await auth();

    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(request);
    let effectivePlayerId: string | null = null;
    
    if (userId) {
      try {
        const effectivePlayer = await getEffectivePlayer(actAsPlayerId);
        effectivePlayerId = effectivePlayer.targetPlayerId;
      } catch (actAsError) {
        console.log('Registrations API: Act As error, using real player:', actAsError);
        // If Act As fails, get the real player
        const realPlayer = await prisma.player.findUnique({
          where: { clerkUserId: userId },
          select: { id: true }
        });
        effectivePlayerId = realPlayer?.id || null;
      }
    }

    // Create registration in a transaction
    const registration = await prisma.$transaction(async (tx) => {
      // Find player - prioritize by effective player ID (act-as) if available, then Clerk user ID, then email
      let player = effectivePlayerId
        ? await tx.player.findUnique({
            where: { id: effectivePlayerId },
          })
        : userId
        ? await tx.player.findUnique({
            where: { clerkUserId: userId },
          })
        : null;

      // If not found by Clerk ID, try email
      if (!player) {
        player = await tx.player.findUnique({
          where: { email: sanitizedPlayerInfo.email },
        });
      }

      if (!player) {
        // For new players, we need required fields
        player = await tx.player.create({
          data: {
            firstName: sanitizedPlayerInfo.firstName,
            lastName: sanitizedPlayerInfo.lastName,
            email: sanitizedPlayerInfo.email,
            phone: sanitizedPlayerInfo.phone,
            gender: 'MALE', // Default, can be updated later
            clubId: selectedClubId || tournament._count.registrations === 0 ? selectedClubId : '', // Placeholder
            clerkUserId: userId || null, // Link to Clerk user if logged in
          },
        });
      } else {
        // Update existing player info with registration data
        const updateData: {
          firstName: string;
          lastName: string;
          phone: string | null;
          email?: string;
          clerkUserId?: string;
        } = {
          firstName: sanitizedPlayerInfo.firstName,
          lastName: sanitizedPlayerInfo.lastName,
          phone: sanitizedPlayerInfo.phone,
        };

        // Only update email if it's different (email is unique)
        if (player.email !== sanitizedPlayerInfo.email) {
          updateData.email = sanitizedPlayerInfo.email;
        }

        // Link to Clerk user if logged in and not already linked
        if (userId && !player.clerkUserId) {
          updateData.clerkUserId = userId;
        }

        await tx.player.update({
          where: { id: player.id },
          data: updateData,
        });
      }

      // Calculate registration amount (in cents for storage)
      // Note: registrationCost is stored in cents, but calculateRegistrationAmount expects dollars
      // So we need to convert from cents to dollars first
      const registrationCostInDollars = tournament.registrationCost ? tournament.registrationCost / 100 : 0;
      const pricingModel = tournament.pricingModel || 'TOURNAMENT_WIDE';
      
      console.log('Registration calculation debug:', {
        tournamentId,
        pricingModel,
        registrationCostInCents: tournament.registrationCost,
        registrationCostInDollars,
        stopIds: selectedStopIds,
        brackets: selectedBrackets,
      });
      
      const subtotal = calculateRegistrationAmount(
        {
          registrationCost: registrationCostInDollars,
          pricingModel,
        },
        {
          stopIds: selectedStopIds,
          brackets: selectedBrackets,
        }
      );
      
      // Calculate tax and total (13% HST for Ontario)
      const { tax, total: registrationAmount } = calculateTotalWithTax(subtotal);
      
      console.log('Registration amount calculated:', {
        subtotal,
        tax,
        total: registrationAmount,
        amountPaidInCents: tournament.registrationType === 'FREE' ? 0 : formatAmountForStripe(registrationAmount),
      });
      
      const amountPaidInCents = tournament.registrationType === 'FREE' 
        ? 0 
        : formatAmountForStripe(registrationAmount);

      // Create registration using TournamentRegistration model
      const newRegistration = await tx.tournamentRegistration.create({
        data: {
          tournamentId,
          playerId: player.id,
          status: 'REGISTERED',
          paymentStatus: tournament.registrationType === 'FREE' ? 'COMPLETED' : 'PENDING',
          amountPaid: amountPaidInCents,
        },
      });

      // Store registration details in notes field (including expected amount for validation)
      await tx.tournamentRegistration.update({
        where: { id: newRegistration.id },
        data: {
          notes: JSON.stringify({
            stopIds: selectedStopIds,
            brackets: selectedBrackets,
            clubId: selectedClubId,
            playerInfo: sanitizedPlayerInfo,
            subtotal: subtotal, // Subtotal before tax (in dollars)
            tax: tax, // Tax amount (in dollars)
            expectedAmount: registrationAmount, // Total with tax (in dollars) - for validation
            pricingModel: tournament.pricingModel || 'TOURNAMENT_WIDE', // Store pricing model used
          }),
        },
      });

      // For free tournaments, create roster entries immediately
      // For paid tournaments, roster entries will be created after payment confirmation (via webhook)
      if (tournament.registrationType === 'FREE' && tournamentIsTeam && selectedClubId && Array.isArray(selectedBrackets)) {
        // Get tournament brackets and club info
        const [brackets, club] = await Promise.all([
          tx.tournamentBracket.findMany({
            where: { tournamentId },
            select: { id: true, name: true },
          }),
          tx.club.findUnique({
            where: { id: selectedClubId },
            select: { name: true },
          }),
        ]);

        const clubName = club?.name || 'Team';

        // Create roster entries for each stop/bracket combination
        for (const stopId of selectedStopIds) {
          // Find the bracket selection for this stop
          const bracketSelection = selectedBrackets.find((sb: any) => sb && sb.stopId === stopId);
          if (!bracketSelection || !bracketSelection.bracketId) {
            console.warn(`No bracket selection found for stop ${stopId}`);
            continue;
          }

          const bracketId = bracketSelection.bracketId;
          const bracket = brackets.find((b) => b.id === bracketId);
          if (!bracket) {
            console.warn(`Bracket ${bracketId} not found for tournament ${tournamentId}`);
            continue;
          }

          // Find or create team for this club and bracket
          let team = await tx.team.findFirst({
            where: {
              tournamentId,
              clubId: selectedClubId,
              bracketId: bracketId,
            },
          });

          if (!team) {
            const teamName = bracket.name === 'DEFAULT' ? clubName : `${clubName} ${bracket.name}`;
            team = await tx.team.create({
              data: {
                name: teamName,
                tournamentId,
                clubId: selectedClubId,
                bracketId: bracketId,
              },
            });
          }

          // Create StopTeamPlayer entry (roster entry)
          try {
            await tx.stopTeamPlayer.upsert({
              where: {
                stopId_teamId_playerId: {
                  stopId,
                  teamId: team.id,
                  playerId: player.id,
                },
              },
              create: {
                stopId,
                teamId: team.id,
                playerId: player.id,
              },
              update: {}, // No update needed if exists
            });
          } catch (rosterError) {
            console.error(`Failed to create roster entry for stop ${stopId}, team ${team.id}, player ${player.id}:`, rosterError);
            throw rosterError; // Re-throw to fail the transaction
          }
        }
      }

      return newRegistration;
    });

    // Send confirmation email for free tournaments, or payment reminder for paid tournaments
    if (tournament.registrationType === 'FREE') {
      try {
        // Get player and tournament details for email
        const [playerDetails, tournamentDetails, brackets] = await Promise.all([
          prisma.player.findUnique({
            where: { id: registration.playerId },
            select: {
              email: true,
              firstName: true,
              lastName: true,
              name: true,
            },
          }),
          prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
              stops: {
                where: { id: { in: selectedStopIds } },
                orderBy: { startAt: 'asc' },
                select: {
                  id: true,
                  name: true,
                  startAt: true,
                  endAt: true,
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
              },
            },
          }),
          prisma.tournamentBracket.findMany({
            where: { tournamentId },
            select: { id: true, name: true },
          }),
        ]);

        if (playerDetails?.email && tournamentDetails) {
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

          // Build stops array with bracket names and club information
          const stopsWithBrackets = tournamentDetails.stops.map((stop) => {
            const bracketSelection = Array.isArray(selectedBrackets)
              ? selectedBrackets.find((sb: any) => sb.stopId === stop.id)
              : null;
            const bracket = bracketSelection
              ? brackets.find((b) => b.id === bracketSelection.bracketId)
              : null;
            return {
              id: stop.id,
              name: stop.name,
              startAt: stop.startAt ? new Date(stop.startAt) : null,
              endAt: stop.endAt ? new Date(stop.endAt) : null,
              bracketName: bracket?.name || null,
              club: stop.club ? {
                name: stop.club.name,
                address1: stop.club.address1,
                city: stop.club.city,
                region: stop.club.region,
                postalCode: stop.club.postalCode,
              } : null,
            };
          });

          // Get club name if team tournament
          let clubName: string | null = null;
          if (tournamentIsTeam && selectedClubId) {
            const club = await prisma.club.findUnique({
              where: { id: selectedClubId },
              select: { name: true },
            });
            clubName = club?.name || null;
          }

          const { sendRegistrationConfirmationEmail } = await import('@/server/email');
          await sendRegistrationConfirmationEmail({
            to: playerDetails.email,
            playerName,
            tournamentName: tournamentDetails.name,
            tournamentId: tournamentId,
            startDate: firstStop?.startAt ? new Date(firstStop.startAt) : null,
            endDate: firstStop?.endAt ? new Date(firstStop.endAt) : null,
            location,
            isPaid: false,
            amountPaid: 0,
            registrationDate: registration.registeredAt,
            stops: stopsWithBrackets,
            clubName,
          });

          console.log('[Registration] Confirmation email sent successfully');
        }
      } catch (emailError) {
        console.error('[Registration] Failed to send confirmation email:', emailError);
        // Don't fail the registration if email fails
      }
    } else {
      // For paid tournaments, send immediate payment reminder
      try {
        const [playerDetails, tournamentDetails] = await Promise.all([
          prisma.player.findUnique({
            where: { id: registration.playerId },
            select: {
              email: true,
              firstName: true,
              lastName: true,
              name: true,
            },
          }),
          prisma.tournament.findUnique({
            where: { id: tournamentId },
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
          }),
        ]);

        if (playerDetails?.email && tournamentDetails) {
          const playerName =
            playerDetails.name ||
            (playerDetails.firstName && playerDetails.lastName
              ? `${playerDetails.firstName} ${playerDetails.lastName}`
              : playerDetails.firstName || 'Player');

          const firstStop = tournamentDetails.stops[0];
          const location = firstStop?.club
            ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
                .filter(Boolean)
                .join(', ')
            : null;

          const { sendPaymentReminderEmail } = await import('@/server/email');
          await sendPaymentReminderEmail({
            to: playerDetails.email,
            playerName,
            tournamentName: tournamentDetails.name,
            tournamentId: tournamentId,
            registrationId: registration.id,
            amount: registration.amountPaid || 0,
            hoursRemaining: 24,
            startDate: firstStop?.startAt ? new Date(firstStop.startAt) : null,
            endDate: firstStop?.endAt ? new Date(firstStop.endAt) : null,
            location,
          });

          console.log('[Registration] Payment reminder email sent successfully');
        }
      } catch (emailError) {
        console.error('[Registration] Failed to send payment reminder email:', emailError);
        // Don't fail the registration if email fails
      }
    }

    return NextResponse.json({
      success: true,
      registrationId: registration.id,
      message: 'Registration successful',
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
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
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        errorName: process.env.NODE_ENV === 'development' ? errorName : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/registrations?tournamentId=xxx
 * Get registrations for a tournament (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      );
    }

    // TODO: Add authentication check for admin access

    const registrations = await prisma.tournamentRegistration.findMany({
      where: { tournamentId },
      include: {
        player: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    return NextResponse.json({ registrations });

  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
