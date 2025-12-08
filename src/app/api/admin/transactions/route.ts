import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { stripe } from '@/lib/stripe/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = await requireAuth('app_admin');
    if (auth instanceof NextResponse) return auth;

    try {
        // Fetch recent charges
        const charges = await stripe.charges.list({
            limit: 50,
            // expand: ['data.customer'] // Optional if we want customer details
        });

        const transactions = charges.data.map(c => ({
            id: c.id,
            amount: c.amount,
            amountRefunded: c.amount_refunded,
            currency: c.currency,
            created: c.created * 1000, // Stripe is seconds, JS is ms
            status: c.status,
            email: c.receipt_email || c.billing_details?.email,
            description: c.description,
            riskScore: c.outcome?.risk_score,
            isRefunded: c.refunded,
        }));

        return NextResponse.json({ transactions });

    } catch (error: any) {
        console.error('Stripe fetch error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch transactions' }, { status: 500 });
    }
}
