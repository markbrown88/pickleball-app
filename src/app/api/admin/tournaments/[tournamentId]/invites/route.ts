import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

type CtxPromise = Promise<{ params: { tournamentId: string } }>;

/**
 * POST /api/admin/tournaments/[tournamentId]/invites
 * Send invites to players (existing players or by email)
 * Body: { playerIds?: string[], inviteEmail?: string, inviteName?: string, expiryDays: number, notes?: string }
 */
export async function POST(req: Request, ctx: CtxPromise) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tournamentId } = await ctx.params;
    const body = await req.json();
    const { playerIds, inviteEmail, inviteName, expiryDays = 7, notes } = body;

    // Verify user is admin of this tournament
    const admin = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin profile not found' }, { status: 404 });
    }

    const isAdmin = await prisma.tournamentAdmin.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId: admin.id,
        },
      },
    });

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'You are not an admin of this tournament' },
        { status: 403 }
      );
    }

    // Get tournament details for emails
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        stops: {
          take: 1,
          orderBy: { startAt: 'asc' },
          select: {
            startAt: true,
            endAt: true,
            club: {
              select: { name: true, city: true, region: true },
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    // Handle inviting existing players
    if (playerIds && Array.isArray(playerIds) && playerIds.length > 0) {
      const createdInvites = [];

      for (const playerId of playerIds) {
        // Check if player already has an invite
        const existingInvite = await prisma.tournamentInvite.findUnique({
          where: {
            tournamentId_playerId: {
              tournamentId,
              playerId,
            },
          },
        });

        if (existingInvite) {
          continue; // Skip if already invited
        }

        // Check if player is already registered
        const existingRegistration = await prisma.tournamentRegistration.findUnique({
          where: {
            tournamentId_playerId: {
              tournamentId,
              playerId,
            },
          },
        });

        if (existingRegistration) {
          continue; // Skip if already registered
        }

        // Create invite
        const invite = await prisma.tournamentInvite.create({
          data: {
            tournamentId,
            playerId,
            invitedBy: admin.id,
            expiresAt,
            notes,
          },
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

        createdInvites.push(invite);

        // Send invite email
        if (invite.player?.email) {
          const playerName =
            invite.player.name ||
            (invite.player.firstName && invite.player.lastName
              ? `${invite.player.firstName} ${invite.player.lastName}`
              : invite.player.firstName || 'Player');

          try {
            const { sendInviteEmail } = await import('@/server/email');

            const firstStop = tournament.stops[0];
            const location = firstStop?.club
              ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
                  .filter(Boolean)
                  .join(', ')
              : null;

            await sendInviteEmail({
              to: invite.player.email,
              playerName,
              tournamentName: tournament.name,
              tournamentId,
              inviteId: invite.id,
              expiresAt,
              startDate: firstStop?.startAt || null,
              endDate: firstStop?.endAt || null,
              location,
              notes: notes || null,
            });
          } catch (emailError) {
            console.error('Failed to send invite email:', emailError);
          }
        }
      }

      return NextResponse.json({
        success: true,
        count: createdInvites.length,
        message: `Sent ${createdInvites.length} invite(s)`,
      });
    }

    // Handle inviting by email (player doesn't exist yet)
    if (inviteEmail && inviteName) {
      // Check if this email already has an invite
      const existingInvite = await prisma.tournamentInvite.findFirst({
        where: {
          tournamentId,
          inviteEmail: inviteEmail.toLowerCase(),
        },
      });

      if (existingInvite) {
        return NextResponse.json(
          { error: 'An invite has already been sent to this email' },
          { status: 400 }
        );
      }

      // Generate invite token for signup link
      const inviteToken = nanoid(32);

      // Create invite
      const invite = await prisma.tournamentInvite.create({
        data: {
          tournamentId,
          inviteEmail: inviteEmail.toLowerCase(),
          inviteName,
          inviteToken,
          invitedBy: admin.id,
          expiresAt,
          notes,
        },
      });

      // Send invite email
      try {
        const { sendInviteEmail } = await import('@/server/email');

        const firstStop = tournament.stops[0];
        const location = firstStop?.club
          ? [firstStop.club.name, firstStop.club.city, firstStop.club.region]
              .filter(Boolean)
              .join(', ')
          : null;

        await sendInviteEmail({
          to: inviteEmail,
          playerName: inviteName,
          tournamentName: tournament.name,
          tournamentId,
          inviteId: invite.id,
          inviteToken,
          expiresAt,
          startDate: firstStop?.startAt || null,
          endDate: firstStop?.endAt || null,
          location,
          notes: notes || null,
        });
      } catch (emailError) {
        console.error('Failed to send invite email:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: 'Invite sent successfully',
        inviteId: invite.id,
      });
    }

    return NextResponse.json(
      { error: 'Must provide either playerIds or inviteEmail/inviteName' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error sending invites:', error);
    return NextResponse.json({ error: 'Failed to send invites' }, { status: 500 });
  }
}
