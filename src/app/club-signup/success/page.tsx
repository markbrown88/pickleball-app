'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

function SuccessContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const isFree = searchParams.get('free') === 'true';
    const clubId = searchParams.get('clubId');

    // We could fetch club details here if we want to personalize it
    // For now, generic success message

    return (
        <div className="text-center space-y-8">
            <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-5xl">🎉</span>
            </div>

            <div className="space-y-4">
                <h1 className="text-4xl font-bold text-primary">
                    {isFree ? 'Registration Complete!' : 'Subscription Active!'}
                </h1>
                <p className="text-xl text-muted max-w-lg mx-auto">
                    {isFree
                        ? 'Your club is now registered. You can list your club in the directory and join tournaments.'
                        : 'Welcome to the Tournament Director tier. You can now create and manage your own tournaments.'}
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                <Link href="/dashboard" className="btn btn-primary px-8 py-3 text-lg">
                    Go to Dashboard
                </Link>
                <Link href={clubId ? `/clubs/${clubId}` : '/clubs'} className="btn btn-outline px-8 py-3 text-lg">
                    View Club Profile
                </Link>
            </div>

            {!isFree && (
                <p className="text-sm text-muted mt-4">
                    A receipt has been sent to your email.
                </p>
            )}
        </div>
    );
}

export default function ClubSignupSuccessPage() {
    return (
        <div className="min-h-screen bg-app flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-surface-1 rounded-2xl shadow-xl p-12 border border-subtle">
                <Suspense fallback={<div>Loading result...</div>}>
                    <SuccessContent />
                </Suspense>
            </div>
        </div>
    );
}
