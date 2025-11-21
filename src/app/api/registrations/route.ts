import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { validateRegistration, sanitizeInput } from '@/lib/validation/registration';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';
import { calculateRegistrationAmount } from '@/lib/payments/calculateAmount';
import { calculateTotalWithTax } from '@/lib/payments/calculateTax';
import { formatAmountForStripe } from '@/lib/stripe/config';
import { formatPhoneForStorage } from '@/lib/phone';
import { isTeamTournament } from '@/lib/tournamentTypeConfig';

/**
 * POST /api/registrations
 * Create a new tournament registration
 */
export async function POST(request: NextRequest) {
  let requestBody: any = null;
  try {
    requestBody = await request.json();
    const body = requestBody;

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

    // Validate that selectedStopIds is an array and not empty
    if (!Array.isArray(selectedStopIds) || selectedStopIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one tournament stop must be selected' },
        { status: 400 }
      );
    }

    // Validate that selectedBrackets is an array
    if (!Array.isArray(selectedBrackets)) {
      return NextResponse.json(
        { error: 'Bracket selections must be an array' },
        { status: 400 }
      );
    }

    // Validate that all selected stops are in the future
    const stops = await prisma.stop.findMany({
      where: {
        id: { in: selectedStopIds },
      },
      select: {
        id: true,
        name: true,
        startAt: true,
        endAt: true,
      },
    });

    const now = new Date();
    const pastStops = stops.filter((stop) => {
      if (stop.endAt) {
        return new Date(stop.endAt) < now;
      } else if (stop.startAt) {
        return new Date(stop.startAt) < now;
      }
      return false;
    });

    if (pastStops.length > 0) {
      const pastStopNames = pastStops.map((s) => s.name).join(', ');
      return NextResponse.json(
        { 
          error: `Cannot register for stops that have already passed: ${pastStopNames}`,
          pastStops: pastStops.map((s) => ({ id: s.id, name: s.name })),
        },
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
      phone: playerInfo.phone ? formatPhoneForStorage(playerInfo.phone) : null,
      gender: playerInfo.gender && (playerInfo.gender === 'MALE' || playerInfo.gender === 'FEMALE') 
        ? playerInfo.gender 
        : 'MALE', // Default to MALE if not provided or invalid
    };

    // Check for duplicate registration
    // For multi-stop tournaments, update existing registration to include new stops
    // The database has a unique constraint on [tournamentId, playerId], so we can only have one registration per tournament/player
    const existingPlayer = await prisma.player.findUnique({
      where: { email: sanitizedPlayerInfo.email },
    });

    let existingRegistrationId: string | null = null;
    let existingStopIds: string[] = [];
    let existingBrackets: Array<{ stopId: string; bracketId: string; gameTypes: string[] }> = [];
    let existingClubId: string | null = null;

    if (existingPlayer) {
      const existingReg = await prisma.tournamentRegistration.findFirst({
        where: {
          tournamentId,
          playerId: existingPlayer.id,
          status: 'REGISTERED', // Only check active registrations
        },
        select: {
          id: true,
          notes: true,
          paymentStatus: true, // Need to check payment status
        },
      });

      if (existingReg) {
        existingRegistrationId = existingReg.id;
        
        // Parse existing registration data
        if (existingReg.notes) {
          try {
            const notes = JSON.parse(existingReg.notes);
            existingStopIds = notes.stopIds || [];
            existingBrackets = notes.brackets || [];
            existingClubId = notes.clubId || null;
          } catch (e) {
            console.warn(`Could not parse notes for registration ${existingReg.id}:`, e);
          }
        }

        // Only block overlapping stops if the existing registration is PAID or COMPLETED
        // If it's PENDING, allow them to proceed to payment
        const isPaid = existingReg.paymentStatus === 'PAID' || existingReg.paymentStatus === 'COMPLETED';

        // Check if tournament has multiple stops
        const tournamentStops = await prisma.stop.findMany({
          where: { tournamentId },
          select: { id: true },
        });
        const hasMultipleStops = tournamentStops.length > 1;

        if (hasMultipleStops) {
          // Check for overlap between existing stops and new stops
          // Only block if the existing registration is paid
          const overlappingStops = selectedStopIds.filter((stopId: string) => existingStopIds.includes(stopId));
          
          if (overlappingStops.length > 0 && isPaid) {
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
          // No overlap OR existing registration is PENDING - will update existing registration to include new stops
        } else {
          // Single stop tournament - only block if paid
          if (isPaid) {
            return NextResponse.json(
              { error: 'A registration with this email already exists for this tournament' },
              { status: 409 }
            );
          }
          // If PENDING, allow them to proceed to payment
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
        // For team tournaments, clubId is required
        // For individual tournaments, clubId can be null
        const clubIdForNewPlayer = tournamentIsTeam 
          ? (selectedClubId || null)
          : null;
        
        player = await tx.player.create({
          data: {
            firstName: sanitizedPlayerInfo.firstName,
            lastName: sanitizedPlayerInfo.lastName,
            email: sanitizedPlayerInfo.email,
            phone: sanitizedPlayerInfo.phone,
            gender: sanitizedPlayerInfo.gender,
            clubId: clubIdForNewPlayer,
            clerkUserId: userId || null, // Link to Clerk user if logged in
          },
        });
      } else {
        // Update existing player info with registration data
        const updateData: {
          firstName: string;
          lastName: string;
          phone: string | null;
          gender?: 'MALE' | 'FEMALE';
          email?: string;
          clerkUserId?: string;
        } = {
          firstName: sanitizedPlayerInfo.firstName,
          lastName: sanitizedPlayerInfo.lastName,
          phone: sanitizedPlayerInfo.phone,
        };

        // Update gender if provided
        if (sanitizedPlayerInfo.gender) {
          updateData.gender = sanitizedPlayerInfo.gender;
        }

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

      // Check if we're updating an existing registration or creating a new one
      let registration;
      let finalStopIds: string[];
      let finalBrackets: Array<{ stopId: string; bracketId: string; gameTypes: string[] }>;
      let finalSubtotal: number;
      let finalTax: number;
      let finalTotal: number;
      let finalAmountPaidInCents: number;
      
      if (existingRegistrationId) {
        // Update existing registration to include new stops
        // Merge new stops with existing stops (avoid duplicates)
        const mergedStopIds = [...new Set([...existingStopIds, ...selectedStopIds])];
        const mergedBrackets = [...existingBrackets];
        
        // Add new brackets, avoiding duplicates for the same stopId+bracketId combination
        for (const newBracket of selectedBrackets) {
          const existingIndex = mergedBrackets.findIndex(
            (b: any) => b.stopId === newBracket.stopId && b.bracketId === newBracket.bracketId
          );
          if (existingIndex === -1) {
            mergedBrackets.push(newBracket);
          }
        }
        
        // Get existing registration to check amount already paid
        const existingReg = await tx.tournamentRegistration.findUnique({
          where: { id: existingRegistrationId },
          select: {
            amountPaid: true,
            notes: true,
          },
        });
        
        // Calculate price for ONLY NEW stops (not already registered)
        const newStopSubtotal = calculateRegistrationAmount(
          {
            registrationCost: registrationCostInDollars,
            pricingModel,
          },
          {
            stopIds: selectedStopIds, // Only new stops
            brackets: selectedBrackets, // Only new brackets
          }
        );
        const { tax: newStopTax, total: newStopTotal } = calculateTotalWithTax(newStopSubtotal);
        const newStopAmountPaidInCents = tournament.registrationType === 'FREE' 
          ? 0 
          : formatAmountForStripe(newStopTotal);
        
        // Calculate total amount for all stops (for display/storage purposes)
        const mergedSubtotal = calculateRegistrationAmount(
          {
            registrationCost: registrationCostInDollars,
            pricingModel,
          },
          {
            stopIds: mergedStopIds,
            brackets: mergedBrackets,
          }
        );
        const { tax: mergedTax, total: mergedTotal } = calculateTotalWithTax(mergedSubtotal);
        
        // IMPORTANT: Don't update amountPaid here - it will be updated by the webhook when payment is confirmed
        // The amountPaid field should only reflect what was actually paid in Stripe, not what we expect to charge
        const existingAmountPaid = existingReg?.amountPaid || 0;
        
        // Store final values for use after update
        finalStopIds = mergedStopIds;
        finalBrackets = mergedBrackets;
        finalSubtotal = mergedSubtotal;
        finalTax = mergedTax;
        finalTotal = mergedTotal;
        // Keep existing amountPaid - webhook will add the new payment amount when confirmed
        finalAmountPaidInCents = existingAmountPaid;
        
        // Parse existing notes to preserve other data
        let existingNotes: any = {};
        if (existingReg?.notes) {
          try {
            existingNotes = JSON.parse(existingReg.notes);
          } catch (e) {
            console.warn('Failed to parse existing registration notes:', e);
          }
        }
        
        // Update existing registration
        registration = await tx.tournamentRegistration.update({
          where: { id: existingRegistrationId },
          data: {
            // Update payment status if needed (if it was PENDING and now FREE, or vice versa)
            paymentStatus: tournament.registrationType === 'FREE' ? 'COMPLETED' : 'PENDING',
            // Don't update amountPaid here - webhook will update it when payment is confirmed
            // amountPaid should only reflect what was actually paid, not what we expect to charge
            notes: JSON.stringify({
              stopIds: mergedStopIds,
              brackets: mergedBrackets,
              clubId: selectedClubId || existingClubId || existingNotes.clubId, // Use new clubId if provided, otherwise keep existing
              playerInfo: sanitizedPlayerInfo,
              subtotal: mergedSubtotal,
              tax: mergedTax,
              expectedAmount: mergedTotal,
              pricingModel: tournament.pricingModel || 'TOURNAMENT_WIDE',
              // Store pricing info for new stops separately
              newStopsSubtotal: newStopSubtotal,
              newStopsTax: newStopTax,
              newStopsTotal: newStopTotal,
              existingAmountPaid: existingAmountPaid,
              // Store which stops were newly selected (for payment calculation fallback)
              newlySelectedStopIds: selectedStopIds,
              newlySelectedBrackets: selectedBrackets,
            }),
          },
        });
      } else {
        // Create new registration
        finalStopIds = selectedStopIds;
        finalBrackets = selectedBrackets;
        finalSubtotal = subtotal;
        finalTax = tax;
        finalTotal = registrationAmount;
        finalAmountPaidInCents = amountPaidInCents;
        
        registration = await tx.tournamentRegistration.create({
          data: {
            tournamentId,
            playerId: player.id,
            status: 'REGISTERED',
            paymentStatus: tournament.registrationType === 'FREE' ? 'COMPLETED' : 'PENDING',
            amountPaid: amountPaidInCents,
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
      }

      // For free tournaments, create roster entries immediately
      // For paid tournaments, roster entries will be created after payment confirmation (via webhook)
      // Only create roster entries for NEW stops (not already existing)
      const clubIdToUse = selectedClubId || existingClubId;
      
      if (tournament.registrationType === 'FREE' && tournamentIsTeam && clubIdToUse && Array.isArray(finalBrackets)) {
        // Get tournament brackets and club info
        const [brackets, club] = await Promise.all([
          tx.tournamentBracket.findMany({
            where: { tournamentId },
            select: { id: true, name: true },
          }),
          tx.club.findUnique({
            where: { id: clubIdToUse },
            select: { name: true },
          }),
        ]);

        const clubName = club?.name || 'Team';

        // Create roster entries for each stop/bracket combination
        // Only create entries for NEW stops (not already existing)
        const stopsToCreateEntriesFor = existingRegistrationId 
          ? selectedStopIds.filter((stopId: string) => !existingStopIds.includes(stopId))
          : selectedStopIds;
        
        for (const stopId of stopsToCreateEntriesFor) {
          // Find the bracket selection for this stop
          const bracketSelection = finalBrackets.find((sb: any) => sb && sb.stopId === stopId);
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
              clubId: clubIdToUse,
              bracketId: bracketId,
            },
          });

          if (!team) {
            const teamName = bracket.name === 'DEFAULT' ? clubName : `${clubName} ${bracket.name}`;
            team = await tx.team.create({
              data: {
                name: teamName,
                tournamentId,
                clubId: clubIdToUse,
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

      return registration;
    });

    // Parse final stopIds and brackets from registration notes for email
    let emailStopIds: string[] = selectedStopIds;
    let emailBrackets: Array<{ stopId: string; bracketId: string; gameTypes: string[] }> = selectedBrackets;
    let emailClubId: string | null = selectedClubId || null;
    
    if (registration.notes) {
      try {
        const notes = JSON.parse(registration.notes);
        emailStopIds = notes.stopIds || selectedStopIds;
        emailBrackets = notes.brackets || selectedBrackets;
        emailClubId = notes.clubId || selectedClubId || null;
      } catch (e) {
        console.warn('Could not parse registration notes for email:', e);
      }
    }

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
                where: { id: { in: emailStopIds } },
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
            const bracketSelection = Array.isArray(emailBrackets)
              ? emailBrackets.find((sb: any) => sb.stopId === stop.id)
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
          if (tournamentIsTeam && emailClubId) {
            const club = await prisma.club.findUnique({
              where: { id: emailClubId },
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
    } else if (tournament.registrationType === 'PAID' && registration.paymentStatus === 'PENDING') {
      // Send immediate payment reminder email for paid tournaments with pending payment
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
                where: { id: { in: emailStopIds } },
                orderBy: { startAt: 'asc' },
                select: {
                  id: true,
                  name: true,
                  startAt: true,
                  endAt: true,
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

          // Build stops array with bracket names and club information
          const stopsWithBrackets = tournamentDetails.stops.map((stop) => {
            const bracketSelection = Array.isArray(emailBrackets)
              ? emailBrackets.find((sb: any) => sb.stopId === stop.id)
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
                address: stop.club.address,
                address1: stop.club.address1,
                city: stop.club.city,
                region: stop.club.region,
                postalCode: stop.club.postalCode,
              } : null,
            };
          });

          // Get club name if team tournament
          let clubName: string | null = null;
          if (tournamentIsTeam && emailClubId) {
            const club = await prisma.club.findUnique({
              where: { id: emailClubId },
              select: { name: true },
            });
            clubName = club?.name || null;
          }

          const { sendPaymentReminderEmail } = await import('@/server/email');
          await sendPaymentReminderEmail({
            to: playerDetails.email,
            playerName,
            tournamentName: tournamentDetails.name,
            tournamentId: tournamentId,
            registrationId: registration.id,
            amount: registration.amountPaid ?? 0,
            hoursRemaining: 24, // 24 hours to complete payment
            startDate: stopsWithBrackets.length > 0 ? stopsWithBrackets[0]?.startAt || null : null,
            endDate: stopsWithBrackets.length > 0 ? stopsWithBrackets[stopsWithBrackets.length - 1]?.endAt || null : null,
            stops: stopsWithBrackets.length > 0 ? stopsWithBrackets : undefined,
            clubName,
          });

          console.log('[Registration] Payment reminder email sent successfully');
        }
      } catch (emailError) {
        console.error('[Registration] Failed to send payment reminder email:', emailError);
        // Don't fail the registration if email fails
      }
    }
    // Note: Additional payment reminder emails are sent by the cron job (/api/cron/payment-reminders)
    // at 12 hours and 24 hours if payment is still pending.

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
    
    // Log request body for debugging (without sensitive data)
    if (requestBody) {
      console.error('Request body (sanitized):', {
        tournamentId: requestBody.tournamentId,
        selectedStopIds: requestBody.selectedStopIds,
        selectedBracketsCount: Array.isArray(requestBody.selectedBrackets) ? requestBody.selectedBrackets.length : 'not an array',
        hasPlayerInfo: !!requestBody.playerInfo,
        hasSelectedClubId: !!requestBody.selectedClubId,
      });
    } else {
      console.error('Request body not available (may have failed to parse)');
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
