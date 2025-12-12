'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RegistrationStepper } from '@/app/register/[tournamentId]/components/RegistrationStepper';
import { RequiredInfoStep } from './components/RequiredInfoStep';
import { OptionalInfoStep } from './components/OptionalInfoStep';

type Step = 'required' | 'optional';

type Club = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
};

type PlayerData = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  clubId: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  birthday: Date | null;
  birthdayYear: number | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  duprSingles: number | null;
  duprDoubles: number | null;
  clubRatingSingles: number | null;
  clubRatingDoubles: number | null;
  interestedInWildcard: boolean | null;
  interestedInCaptain: string | null;
};

type OnboardingData = {
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  clubId: string;
  email: string;
  birthday: string; // YYYY-MM-DD format - required
  phone: string;
  city: string;
  region: string;
  country: string;
  duprSingles: string;
  duprDoubles: string;
  clubRatingSingles: string;
  clubRatingDoubles: string;
  interestedInWildcard: string; // 'yes' | 'no' | ''
  interestedInCaptain: string;  // 'YES' | 'NO' | 'MAYBE' | ''
};

type OnboardingFlowProps = {
  player: PlayerData;
  userEmail: string;
  clubs: Club[];
};

const steps = [
  { id: 'required', label: 'Required Info', description: 'Basic information' },
  { id: 'optional', label: 'Optional Info', description: 'Additional details' },
];

export function OnboardingFlow({ player, userEmail, clubs }: OnboardingFlowProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('required');
  const [saving, setSaving] = useState(false);

  // Initialize form data from existing player data
  const formatDate = (year: number | null, month: number | null, day: number | null): string => {
    if (year && month && day) {
      const monthStr = String(month).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      return `${year}-${monthStr}-${dayStr}`;
    }
    return '';
  };

  const [formData, setFormData] = useState<OnboardingData>({
    firstName: player.firstName || '',
    lastName: player.lastName || '',
    gender: player.gender || 'MALE',
    clubId: player.clubId || '',
    email: userEmail,
    birthday: formatDate(player.birthdayYear, player.birthdayMonth, player.birthdayDay),
    phone: player.phone || '',
    city: player.city || '',
    region: player.region || '',
    country: player.country || 'Canada',
    duprSingles: player.duprSingles?.toString() || '',
    duprDoubles: player.duprDoubles?.toString() || '',
    clubRatingSingles: player.clubRatingSingles?.toString() || '',
    clubRatingDoubles: player.clubRatingDoubles?.toString() || '',
    interestedInWildcard: player.interestedInWildcard === true ? 'yes' : player.interestedInWildcard === false ? 'no' : '',
    interestedInCaptain: player.interestedInCaptain || '',
  });

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const goToNextStep = () => {
    if (currentStep === 'required') {
      setCurrentStep('optional');
    }
  };

  const goToPreviousStep = () => {
    if (currentStep === 'optional') {
      setCurrentStep('required');
    }
  };

  const handleSave = async (skipOptional = false) => {
    setSaving(true);
    try {
      const payload: any = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        gender: formData.gender,
        clubId: formData.clubId,
        email: formData.email.trim(),
        birthday: formData.birthday, // Birthday is now required
      };

      // Only include optional fields if not skipping
      if (!skipOptional) {
        payload.phone = formData.phone.trim() || null;
        payload.city = formData.city.trim() || null;
        payload.region = formData.region.trim() || null;
        payload.country = formData.country.trim() || 'Canada';
        payload.duprSingles = formData.duprSingles ? parseFloat(formData.duprSingles) : null;
        payload.duprDoubles = formData.duprDoubles ? parseFloat(formData.duprDoubles) : null;
        payload.clubRatingSingles = formData.clubRatingSingles ? parseFloat(formData.clubRatingSingles) : null;
        payload.clubRatingDoubles = formData.clubRatingDoubles ? parseFloat(formData.clubRatingDoubles) : null;
        payload.interestedInWildcard = formData.interestedInWildcard === 'yes' ? true : formData.interestedInWildcard === 'no' ? false : null;
        payload.interestedInCaptain = formData.interestedInCaptain || null;
      }

      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save profile');
      }

      // Redirect to dashboard after successful save
      router.push('/dashboard');
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      alert(error instanceof Error ? error.message : 'Failed to save profile. Please try again.');
      setSaving(false);
    }
  };

  const updateFormData = (updates: Partial<OnboardingData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className="min-h-screen bg-surface-1">
      {/* Header */}
      <div className="bg-surface-2 border-b border-border-subtle">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-primary mb-2">Complete Your Profile</h1>
          <p className="text-sm text-muted">We need a few details to get you started</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <RegistrationStepper
          steps={steps}
          currentStep={currentStep}
          onStepClick={(stepId) => {
            // Only allow going back, not forward
            if (stepId === 'required' && currentStep === 'optional') {
              setCurrentStep('required');
            }
          }}
        />
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className="bg-surface-2 border border-border-subtle rounded-lg p-6 register-form">
          {currentStep === 'required' && (
            <RequiredInfoStep
              formData={formData}
              clubs={clubs}
              onUpdate={updateFormData}
              onNext={goToNextStep}
            />
          )}

          {currentStep === 'optional' && (
            <OptionalInfoStep
              formData={formData}
              onUpdate={updateFormData}
              onBack={goToPreviousStep}
              onSave={handleSave}
              onSkip={() => handleSave(true)}
              saving={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}

