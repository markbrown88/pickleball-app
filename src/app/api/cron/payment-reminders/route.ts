import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPaymentReminderEmail } from '@/server/email';

/**
 * POST /api/cron/payment-reminders
 * Cron job to send payment reminders and cancel expired registrations
 * 
 * Should be called:
 * - Every hour to check for 12-hour reminders
 * - Every hour to check for 24-hour cancellations
 * 
 * Vercel Cron Config (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/payment-reminders",
 *     "schedule": "0 * * * *"  // Every hour
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  // Verify this is a cron request (Vercel sets this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find registrations that need 12-hour reminder
    // Registered between 12-13 hours ago, payment still pending, haven't sent 12h reminder
    // Exclude registrations that have a paymentId (indicating payment was processed, even if status not updated)
    const registrationsFor12HourReminder = await prisma.tournamentRegistration.findMany({
      where: {
        paymentStatus: 'PENDING',
        paymentId: null, // Exclude if paymentId exists (payment was processed)
        registeredAt: {
          gte: new Date(twelveHoursAgo.getTime() - 60 * 60 * 1000), // 12-13 hours ago
          lt: twelveHoursAgo,
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
            startDate: true,
            registrationType: true, // Need to filter out FREE tournaments
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

    // Send 12-hour reminders
    let remindersSent = 0;
    for (const registration of registrationsFor12HourReminder) {
      // Check if we've already sent a 12-hour reminder (stored in notes)
      let notes: any = {};
      if (registration.notes) {
        try {
          notes = JSON.parse(registration.notes);
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Skip if already sent 12h reminder
      if (notes.reminder12hSent) {
        continue;
      }

      // Only send reminder if payment process was started (has stripeSessionId)
      // This means they got to the payment step but didn't complete it
      if (!notes.stripeSessionId) {
        continue; // Skip - they never started the payment process
      }

      // Skip free tournaments - no payment needed
      if (registration.tournament.registrationType === 'FREE') {
        continue;
      }

      if (registration.player?.email) {
        try {
          const playerName =
            registration.player.name ||
            (registration.player.firstName && registration.player.lastName
              ? `${registration.player.firstName} ${registration.player.lastName}`
              : registration.player.firstName || 'Player');

          const firstStop = registration.tournament.stops[0];
          const location = firstStop?.club
            ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
                .filter(Boolean)
                .join(', ')
            : null;

          await sendPaymentReminderEmail({
            to: registration.player.email,
            playerName,
            tournamentName: registration.tournament.name,
            tournamentId: registration.tournamentId,
            registrationId: registration.id,
            amount: registration.amountPaid || 0,
            hoursRemaining: 12,
            startDate: firstStop?.startAt ? new Date(firstStop.startAt) : null,
            endDate: firstStop?.endAt ? new Date(firstStop.endAt) : null,
            location,
          });

          // Mark 12h reminder as sent
          notes.reminder12hSent = true;
          notes.reminder12hSentAt = new Date().toISOString();

          await prisma.tournamentRegistration.update({
            where: { id: registration.id },
            data: {
              notes: JSON.stringify(notes),
            },
          });

          remindersSent++;
        } catch (emailError) {
          console.error(`Failed to send 12h reminder for registration ${registration.id}:`, emailError);
        }
      }
    }

    // Find registrations that need to be canceled (24+ hours old, still pending)
    // Exclude registrations that have a paymentId (indicating payment was processed, even if status not updated)
    const registrationsToCancel = await prisma.tournamentRegistration.findMany({
      where: {
        paymentStatus: 'PENDING',
        paymentId: null, // Exclude if paymentId exists (payment was processed)
        registeredAt: {
          lt: twentyFourHoursAgo,
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
            registrationType: true, // Need to filter out FREE tournaments
          },
        },
      },
    });

    // Cancel expired registrations
    // Only cancel registrations where payment process was started (has stripeSessionId) but not completed
    let cancellations = 0;
    for (const registration of registrationsToCancel) {
      // Check notes to see if payment process was started
      let notes: any = {};
      if (registration.notes) {
        try {
          notes = JSON.parse(registration.notes);
        } catch (e) {
          console.error(`Failed to parse notes for registration ${registration.id}:`, e);
        }
      }

      // Skip if payment process was never started (no stripeSessionId)
      // These are registrations that were created but user never got to payment step
      if (!notes.stripeSessionId) {
        continue;
      }

      // Skip free tournaments - no payment needed
      if (registration.tournament.registrationType === 'FREE') {
        continue;
      }

      try {
        // Update registration status
        await prisma.tournamentRegistration.update({
          where: { id: registration.id },
          data: {
            paymentStatus: 'FAILED',
            status: 'WITHDRAWN',
            withdrawnAt: new Date(),
          },
        });

        // Send cancellation email
        if (registration.player?.email) {
          try {
            const playerName =
              registration.player.name ||
              (registration.player.firstName && registration.player.lastName
                ? `${registration.player.firstName} ${registration.player.lastName}`
                : registration.player.firstName || 'Player');

            const { sendPaymentFailedEmail } = await import('@/server/email');
            await sendPaymentFailedEmail({
              to: registration.player.email,
              playerName,
              tournamentName: registration.tournament.name,
              tournamentId: registration.tournamentId,
              amount: registration.amountPaid || 0,
              failureReason: 'Payment not completed within 24 hours. Registration slot has been released.',
              startDate: null,
              endDate: null,
              location: null,
            });
          } catch (emailError) {
            console.error(`Failed to send cancellation email for registration ${registration.id}:`, emailError);
          }
        }

        cancellations++;
      } catch (error) {
        console.error(`Failed to cancel registration ${registration.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      remindersSent,
      cancellations,
      timestamp: now.toISOString(),
    });

  } catch (error) {
    console.error('Payment reminders cron job error:', error);
    return NextResponse.json(
      { 
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

