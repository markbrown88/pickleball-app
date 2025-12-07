import { stripe } from './config';
import { prisma } from '@/lib/prisma';
import { absoluteUrl } from '@/lib/utils';

export const SUBSCRIPTION_PLANS = {
    MONTHLY: 'monthly',
    ANNUAL: 'annual',
} as const;

export type SubscriptionPlanParams = {
    clubId: string;
    planType: 'monthly' | 'annual';
    userId: string;
    email: string;
};

/**
 * Retrieves the current subscription pricing from SystemSettings
 */
export async function getSubscriptionPricing() {
    const settings = await prisma.systemSettings.findUnique({
        where: { id: 'settings' },
    });

    return {
        monthly: settings?.monthlySubscriptionPrice ?? 6999,
        annual: settings?.annualSubscriptionPrice ?? 79999,
        isEnabled: settings?.isSubscriptionEnabled ?? true,
    };
}

/**
 * Creates a Stripe Checkout Session for a Club Subscription
 */
export async function createSubscriptionCheckoutSession({
    clubId,
    planType,
    userId,
    email,
}: SubscriptionPlanParams) {
    const pricing = await getSubscriptionPricing();

    if (!pricing.isEnabled) {
        throw new Error('Subscriptions are currently disabled.');
    }

    const priceAmount =
        planType === 'monthly' ? pricing.monthly : pricing.annual;

    const interval = planType === 'monthly' ? 'month' : 'year';

    // Create a price object just-in-time (or you could sync Products)
    // For simplicity and dynamic admin control, we'll use "price_data" inline
    // Note: Only works if you don't need to track specific Product IDs in Stripe for reporting
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'cad',
                    product_data: {
                        name: `Klyng Cup ${planType === 'monthly' ? 'Monthly' : 'Annual'} Membership`,
                        description: 'Tournament management features for your club',
                    },
                    unit_amount: priceAmount,
                    recurring: {
                        interval: interval as 'month' | 'year',
                    },
                },
                quantity: 1,
            },
        ],
        metadata: {
            clubId,
            userId,
            planType,
            type: 'CLUB_SUBSCRIPTION',
        },
        customer_email: email,
        subscription_data: {
            metadata: {
                clubId,
                type: 'CLUB_SUBSCRIPTION',
            },
            trial_period_days: 30, // 30-day free trial as requested
        },
        success_url: absoluteUrl(`/club-signup/success?session_id={CHECKOUT_SESSION_ID}`),
        cancel_url: absoluteUrl(`/club-signup?canceled=true`),
    });

    return session;
}

/**
 * Create a portal session for managing existing subscriptions
 */
export async function createBillingPortalSession(customerId: string, returnUrl: string) {
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    });

    return session;
}
