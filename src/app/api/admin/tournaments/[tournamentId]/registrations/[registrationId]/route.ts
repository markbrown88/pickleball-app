export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type CtxPromise = { params: Promise<{ tournamentId: string; registrationId: string }> };

/**
 * DELETE /api/admin/tournaments/[tournamentId]/registrations/[registrationId]
 * Delete a registration (for testing purposes)
 */
export async function DELETE(_req: Request, ctx: CtxPromise) {
  try {
    const { tournamentId, registrationId } = await ctx.params;

    // Verify registration exists and belongs to tournament
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        tournamentId: true,
        player: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (registration.tournamentId !== tournamentId) {
      return NextResponse.json(
        { error: 'Registration does not belong to this tournament' },
        { status: 400 }
      );
    }

    // Delete the registration
    await prisma.tournamentRegistration.delete({
      where: { id: registrationId },
    });

    return NextResponse.json({
      success: true,
      message: `Registration deleted for ${registration.player.name || registration.player.email}`,
    });
  } catch (error) {
    console.error('Error deleting registration:', error);
    return NextResponse.json(
      { error: 'Failed to delete registration' },
      { status: 500 }
    );
  }
}

