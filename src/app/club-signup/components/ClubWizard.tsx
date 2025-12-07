'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ClubLookupStep from './ClubLookupStep';
import ClubDetailsStep from './ClubDetailsStep';
import SubscriptionStep from './SubscriptionStep';

type WizardStep = 'lookup' | 'details' | 'subscription' | 'success';

interface ClubWizardProps {
    userId?: string;
    userEmail?: string | null;
}

export type ClubData = {
    id?: string; // If claiming existing
    name: string;
    city: string;
    region: string;
    isNew: boolean;
};

export default function ClubWizard({ userId, userEmail }: ClubWizardProps) {
    const [step, setStep] = useState<WizardStep>('lookup');
    const [clubData, setClubData] = useState<ClubData | null>(null);

    const handleClubSelected = (data: ClubData) => {
        setClubData(data);
        setStep('details');
    };

    const handleDetailsConfirmed = (finalData: ClubData) => {
        setClubData(finalData);
        setStep('subscription');
    };

    if (!userId) {
        return <div className="text-center p-8">Loading user profile...</div>;
    }

    return (
        <div className="space-y-8">
            {/* Progress Stepper */}
            <div className="flex justify-between items-center mb-8 px-4">
                {[
                    { id: 'lookup', label: 'Find Club' },
                    { id: 'details', label: 'Details' },
                    { id: 'subscription', label: 'Subscription' }
                ].map((s, idx) => {
                    const isActive = s.id === step;
                    const isPast = ['lookup', 'details', 'subscription', 'success'].indexOf(step) > idx;
                    return (
                        <div key={s.id} className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold 
                ${isActive ? 'bg-brand-primary text-white' : isPast ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {isPast ? '✓' : idx + 1}
                            </div>
                            <span className={`text-xs mt-2 ${isActive ? 'font-bold text-primary' : 'text-muted'}`}>{s.label}</span>
                        </div>
                    );
                })}
            </div>

            {/* Step Content */}
            <div className="min-h-[400px]">
                {step === 'lookup' && (
                    <ClubLookupStep onNext={handleClubSelected} />
                )}

                {step === 'details' && clubData && (
                    <ClubDetailsStep
                        initialData={clubData}
                        userId={userId}
                        onNext={handleDetailsConfirmed}
                        onBack={() => setStep('lookup')}
                    />
                )}

                {step === 'subscription' && clubData && (
                    <SubscriptionStep
                        clubData={clubData}
                        userId={userId}
                        userEmail={userEmail || ''}
                        onBack={() => setStep('details')}
                    />
                )}
            </div>
        </div>
    );
}
