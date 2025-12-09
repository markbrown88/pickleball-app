import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { stripe } from '@/lib/stripe/config';

export async function POST(req: NextRequest) {
    const auth = await requireAuth('app_admin');
    if (auth instanceof NextResponse) return auth;

    try {
        const { chargeId, amount } = await req.json();

        if (!chargeId) {
            return NextResponse.json({ error: 'Charge ID is required' }, { status: 400 });
        }

        // Amount should be in cents. If null/undefined, Stripe refunds full amount.
        // If we pass an amount, verify it's a positive integer.
        if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
            return NextResponse.json({ error: 'Invalid refund amount' }, { status: 400 });
        }

        const refund = await stripe.refunds.create({
            charge: chargeId,
            amount: amount,
        });

        return NextResponse.json({ refund });

    } catch (error: any) {
        console.error('Refund error:', error);
        return NextResponse.json({ error: error.message || 'Refund failed' }, { status: 500 });
    }
}
