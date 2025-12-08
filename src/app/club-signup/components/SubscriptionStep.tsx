'use client';

import { useState } from 'react';
import { ClubData } from './ClubWizard';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe outside render to avoid recreation
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface SubscriptionStepProps {
    clubData: ClubData;
    userId: string;
    userEmail: string;
    onBack: () => void;
}

export default function SubscriptionStep({ clubData, userId, userEmail, onBack }: SubscriptionStepProps) {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
    const [loading, setLoading] = useState(false);

    const handleFreeTier = () => {
        // Just redirect to dashboard or success page
        window.location.href = `/club-signup/success?free=true&clubId=${clubData.id}`;
    };

    const handlePaidSubscribe = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/club-signup/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clubId: clubData.id,
                    planType: billingCycle,
                    email: userEmail
                }),
            });

            if (!res.ok) throw new Error('Failed to start checkout');

            const { url } = await res.json();

            if (url) {
                window.location.href = url;
            } else {
                throw new Error('Failed to retrieve checkout URL');
            }

        } catch (error) {
            console.error(error);
            alert('Something went wrong starting checkout.');
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-primary">Choose Your Plan</h2>
                <p className="text-muted">Unlock powerful tournament management features or stick with the basics.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* FREE TIER */}
                <div className="border border-subtle rounded-xl p-6 hover:shadow-lg transition-shadow bg-surface-1">
                    <div className="h-full flex flex-col">
                        <h3 className="text-xl font-bold text-primary">Participating Club</h3>
                        <p className="text-3xl font-bold mt-4">$0 <span className="text-sm font-normal text-muted">/ forever</span></p>
                        <p className="text-muted mt-2">Perfect for clubs that just want to play.</p>

                        <ul className="mt-8 space-y-3 flex-1">
                            <li className="flex gap-2">✅ <span>Get listed in the directory</span></li>
                            <li className="flex gap-2">✅ <span>Join external tournaments</span></li>
                            <li className="flex gap-2">✅ <span>Manage team rosters</span></li>
                            <li className="flex gap-2 text-muted-foreground">❌ <span>Create your own tournaments</span></li>
                            <li className="flex gap-2 text-muted-foreground">❌ <span>Collect registration fees</span></li>
                        </ul>

                        <button
                            onClick={handleFreeTier}
                            className="mt-8 btn btn-outline w-full py-3"
                        >
                            Continue with Free
                        </button>
                    </div>
                </div>

                {/* PAID TIER */}
                <div className="border border-brand-primary rounded-xl p-6 shadow-md relative bg-surface-1">
                    <div className="absolute top-0 right-0 bg-brand-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                        30-DAY FREE TRIAL
                    </div>

                    <div className="h-full flex flex-col">
                        <h3 className="text-xl font-bold text-brand-primary">Tournament Director</h3>

                        <div className="mt-4 flex items-baseline gap-2">
                            <span className="text-3xl font-bold">
                                {billingCycle === 'annual' ? '$799.99' : '$69.99'}
                            </span>
                            <span className="text-muted">
                                / {billingCycle === 'annual' ? 'year' : 'month'}
                            </span>
                        </div>

                        {/* Toggle */}
                        <div className="flex bg-gray-100 p-1 rounded-lg mt-4 w-fit">
                            <button
                                onClick={() => setBillingCycle('monthly')}
                                className={`px-3 py-1 text-sm rounded-md transition-all ${billingCycle === 'monthly' ? 'bg-white shadow text-primary' : 'text-muted hover:text-primary'}`}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setBillingCycle('annual')}
                                className={`px-3 py-1 text-sm rounded-md transition-all ${billingCycle === 'annual' ? 'bg-white shadow text-brand-primary font-medium' : 'text-muted hover:text-primary'}`}
                            >
                                Annual (Save ~5%)
                            </button>
                        </div>

                        <p className="text-muted mt-4">Everything you need to run professional events.</p>

                        <ul className="mt-6 space-y-3 flex-1">
                            <li className="flex gap-2">✅ <span><b>Create unlimited tournaments</b></span></li>
                            <li className="flex gap-2">✅ <span>Collect payments via Stripe</span></li>
                            <li className="flex gap-2">✅ <span>Advanced bracket management</span></li>
                            <li className="flex gap-2">✅ <span>Real-time scoring & standings</span></li>
                            <li className="flex gap-2">✅ <span>Club Director Dashboard</span></li>
                        </ul>

                        <button
                            onClick={handlePaidSubscribe}
                            disabled={loading}
                            className="mt-8 btn btn-primary w-full py-3 text-lg shadow-lg hover:shadow-xl transform transition-transform active:scale-95"
                        >
                            {loading ? 'Processing...' : `Start 30-Day Free Trial`}
                        </button>
                        <p className="text-xs text-center text-muted mt-2">
                            Cancel anytime. No charge until trial ends.
                        </p>
                    </div>
                </div>
            </div>

            <div className="pt-8 text-center">
                <button onClick={onBack} className="text-muted hover:text-primary underline">
                    Back to Details
                </button>
            </div>
        </div>
    );
}
