import { auth } from '@clerk/nextjs/server';
import { prisma } from './prisma';
import { NextResponse } from 'next/server';

export type AuthLevel = 'app_admin' | 'tournament_admin' | 'event_manager' | 'captain';

export interface AuthContext {
    userId: string;
    player: {
        id: string;
        isAppAdmin: boolean;
        tournamentAdminLinks: Array<{ tournamentId: string }>;
    };
}

export async function requireAuth(requiredLevel?: AuthLevel): Promise<AuthContext | NextResponse> {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const player = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: {
            id: true,
            isAppAdmin: true,
            tournamentAdminLinks: { select: { tournamentId: true } }
        }
    });

    if (!player) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check authorization level
    if (requiredLevel === 'app_admin' && !player.isAppAdmin) {
        return NextResponse.json({ error: 'App admin access required' }, { status: 403 });
    }

    return { userId, player };
}

export async function requireTournamentAccess(
    authCtx: AuthContext,
    tournamentId: string
): Promise<NextResponse | void> {
    // App admins have access to everything
    if (authCtx.player.isAppAdmin) return;

    // Check if user is tournament admin
    const hasAccess = authCtx.player.tournamentAdminLinks.some(
        link => link.tournamentId === tournamentId
    );

    if (!hasAccess) {
        return NextResponse.json(
            { error: 'Access denied to this tournament' },
            { status: 403 }
        );
    }
}

export async function requireStopAccess(
    authCtx: AuthContext,
    stopId: string
): Promise<NextResponse | void> {
    if (authCtx.player.isAppAdmin) return;

    const stop = await prisma.stop.findUnique({
        where: { id: stopId },
        select: { tournamentId: true, eventManagerId: true }
    });

    if (!stop) {
        return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    // Check if user is event manager for this stop
    if (stop.eventManagerId === authCtx.player.id) return;

    // Check if user is tournament admin
    const hasAccess = authCtx.player.tournamentAdminLinks.some(
        link => link.tournamentId === stop.tournamentId
    );

    if (!hasAccess) {
        return NextResponse.json(
            { error: 'Access denied to this stop' },
            { status: 403 }
        );
    }
}
