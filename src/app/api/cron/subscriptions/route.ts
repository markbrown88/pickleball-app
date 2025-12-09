import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/config';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    // Security check: Only allow Vercel Cron (or manual with secret)
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        // 1. Fetch all clubs that SHOULD have a subscription
        const clubs = await prisma.club.findMany({
            where: {
                subscriptionId: { not: null },
                // We check everything with a subscription ID to catch cancelled ones that haven't downgraded
                // But mainly 'SUBSCRIBED' / 'PAST_DUE' are the ones that drift.
            },
            select: { id: true, subscriptionId: true, status: true, subscriptionStatus: true }
        });

        let updatedCount = 0;
        const errors = [];

        for (const club of clubs) {
            if (!club.subscriptionId) continue;

            try {
                const sub = await stripe.subscriptions.retrieve(club.subscriptionId);
                const stripeStatusRaw = sub.status; // 'active', 'past_due', 'canceled', etc.
                const stripeStatusEnum = stripeStatusRaw.toUpperCase();

                let correctClubStatus = 'ACTIVE'; // Default to free

                if (['active', 'trialing'].includes(stripeStatusRaw)) {
                    correctClubStatus = 'SUBSCRIBED';
                } else if (['past_due', 'unpaid', 'incomplete'].includes(stripeStatusRaw)) {
                    correctClubStatus = 'PAST_DUE';
                } else {
                    // 'canceled', 'incomplete_expired', 'paused' -> Demote to Free
                    correctClubStatus = 'ACTIVE';
                }

                // Check if sync needed
                // Note: We cast types because Prisma enums might not perfectly match string literals if not generated yet, 
                // but they should match if SubscriptionStatus enum matches Stripe.
                if (club.status !== correctClubStatus || club.subscriptionStatus !== stripeStatusEnum) {

                    await prisma.club.update({
                        where: { id: club.id },
                        data: {
                            status: correctClubStatus as any,
                            subscriptionStatus: stripeStatusEnum as any,
                        }
                    });

                    updatedCount++;
                    console.log(`Synced Club ${club.id}: ${club.status}->${correctClubStatus} (${stripeStatusRaw})`);
                }

            } catch (err: any) {
                console.error(`Error syncing club ${club.id}:`, err.message);
                errors.push({ clubId: club.id, error: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            processed: clubs.length,
            updated: updatedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        console.error('Cron job failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
