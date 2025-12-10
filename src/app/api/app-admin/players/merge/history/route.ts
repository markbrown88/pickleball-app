import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/app-admin/players/merge/history
 * Fetch recent merge history for audit
 */
export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Verify user is app admin
        const admin = await prisma.player.findUnique({
            where: { clerkUserId: userId },
            select: { id: true, isAppAdmin: true },
        });

        if (!admin?.isAppAdmin) {
            return NextResponse.json({ error: 'App admin access required' }, { status: 403 });
        }

        const logs = await prisma.playerMergeLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                primaryPlayer: {
                    select: { name: true, firstName: true, lastName: true },
                },
                admin: {
                    select: { name: true, firstName: true, lastName: true },
                },
            },
        });

        return NextResponse.json({ logs });
    } catch (error) {
        console.error('Error fetching merge history:', error);
        return NextResponse.json(
            { error: 'Failed to fetch merge history' },
            { status: 500 }
        );
    }
}
