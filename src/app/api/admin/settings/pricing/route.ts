import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const auth = await requireAuth('app_admin');
    if (auth instanceof NextResponse) return auth;

    try {
        const settings = await prisma.systemSettings.findUnique({
            where: { id: 'settings' }
        });

        // Return defaults if not set
        return NextResponse.json({
            settings: settings || {
                monthlySubscriptionPrice: 6999,
                annualSubscriptionPrice: 79999,
                isSubscriptionEnabled: true,
            }
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const auth = await requireAuth('app_admin');
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await request.json();
        const { monthlySubscriptionPrice, annualSubscriptionPrice, isSubscriptionEnabled } = body;

        const settings = await prisma.systemSettings.upsert({
            where: { id: 'settings' },
            update: {
                monthlySubscriptionPrice,
                annualSubscriptionPrice,
                isSubscriptionEnabled,
            },
            create: {
                id: 'settings',
                monthlySubscriptionPrice,
                annualSubscriptionPrice,
                isSubscriptionEnabled,
            }
        });

        return NextResponse.json({ settings });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
