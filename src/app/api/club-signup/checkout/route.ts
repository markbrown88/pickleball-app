import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSubscriptionCheckoutSession } from '@/lib/stripe/subscription';
import { prisma } from '@/lib/prisma'; // To verify club ownership

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { clubId, planType, email } = body;

        if (!clubId || !planType || !email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify current user owns this club (security check)
        // We check either legacy directorId OR new ClubDirector table
        // Since we just created it in wizard, it should match.
        // However, since migration assumes legacy is migrated, let's just check if user is linked.
        const player = await prisma.player.findUnique({
            where: { clerkUserId: userId },
            select: { id: true }
        });

        if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 400 });

        /* 
           We could verify ownership here, but for "Signup" flow, 
           we trust the wizard passed the ID they just created.
           Strictly speaking, we SHOULD verify:
        */
        const club = await prisma.club.findFirst({
            where: {
                id: clubId,
                OR: [
                    { directorId: player.id },
                    { directors: { some: { playerId: player.id, role: 'ADMIN' } } }
                ]
            }
        });

        if (!club) {
            return NextResponse.json({ error: 'You are not authorized to subscribe for this club.' }, { status: 403 });
        }

        const session = await createSubscriptionCheckoutSession({
            clubId,
            planType,
            userId, // Clerk ID for metadata
            email,
        });

        return NextResponse.json({ sessionId: session.id });

    } catch (error: any) {
        console.error('Checkout creation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create checkout session' },
            { status: 500 }
        );
    }
}
