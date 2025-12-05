import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth('app_admin');
    if (authResult instanceof NextResponse) return authResult;

    // Get all players for the "Act As" dropdown
    const players = await prisma.player.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isAppAdmin: true
      },
      orderBy: [
        { isAppAdmin: 'desc' },
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    });

    return NextResponse.json({ items: players });

  } catch (error) {
    console.error('Error fetching players for act-as:', error);
    return NextResponse.json(
      { error: 'Failed to fetch players' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth('app_admin');
    if (authResult instanceof NextResponse) return authResult;

    const { player: adminPlayer } = authResult; // authResult is AuthContext here

    const body = await req.json();
    const { targetPlayerId } = body;

    if (!targetPlayerId) {
      return NextResponse.json({ error: 'targetPlayerId required' }, { status: 400 });
    }

    // Get the target player's information
    const targetPlayer = await prisma.player.findUnique({
      where: { id: targetPlayerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isAppAdmin: true,
        club: {
          select: {
            id: true,
            name: true,
            city: true
          }
        }
      }
    });

    if (!targetPlayer) {
      return NextResponse.json({ error: 'Target player not found' }, { status: 404 });
    }

    // Audit Log: START session
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await prisma.actAsAuditLog.create({
      data: {
        adminPlayerId: adminPlayer.id,
        targetPlayerId: targetPlayer.id,
        action: 'START',
        endpoint: '/api/admin/act-as',
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours expiry for logic
      }
    });

    // Return the target player's information for impersonation
    return NextResponse.json({
      success: true,
      targetPlayer,
      message: `Now acting as ${targetPlayer.firstName} ${targetPlayer.lastName}`
    });

  } catch (error) {
    console.error('Error in act-as:', error);
    return NextResponse.json(
      { error: 'Failed to act as player' },
      { status: 500 }
    );
  }
}

