'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RegistrationStepper } from './components/RegistrationStepper';
import { PlayerInfoStep } from './components/PlayerInfoStep';
import { StopSelectionStep } from './components/StopSelectionStep';
import { BracketSelectionStep } from './components/BracketSelectionStep';
import { ReviewStep } from './components/ReviewStep';
import { requiresStopSelection, requiresBracketSelection, isTeamTournament } from '@/lib/tournamentTypeConfig';

type Step = 'info' | 'stops' | 'brackets' | 'review';

type TournamentData = {
  id: string;
  name: string;
  type: string;
  registrationType: string;
  registrationCost: number | null;
  pricingModel: string;
  maxPlayers: number | null;
  restrictionNotes: string[];
  stops: Array<{
    id: string;
    name: string;
    startAt: string | null;
    endAt: string | null;
    registrationDeadline: string | null;
    isRegistrationClosed: boolean;
  }>;
  brackets: Array<{
    id: string;
    name: string;
    idx: number;
  }>;
  clubs: Array<{
    id: string;
    name: string;
    city: string | null;
    region: string | null;
  }>;
};

export type PlayerInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type RegistrationData = {
  playerInfo: PlayerInfo;
  selectedStopIds: string[];
  selectedClubId?: string;
  selectedBrackets: Array<{
    stopId: string;
    bracketId: string;
    gameTypes: string[];
  }>;
};

type TournamentRegistrationFlowProps = {
  tournament: TournamentData;
  initialPlayerInfo?: PlayerInfo | null;
};

export function TournamentRegistrationFlow({ tournament, initialPlayerInfo }: TournamentRegistrationFlowProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    playerInfo: initialPlayerInfo || {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    },
    selectedStopIds: [],
    selectedBrackets: [],
  });

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel registration? Your progress will be lost.')) {
      router.push('/dashboard');
    }
  };

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const goToStep = (step: Step | string) => {
    setCurrentStep(step as Step);
  };

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const updatePlayerInfo = (info: PlayerInfo) => {
    setRegistrationData((prev) => ({ ...prev, playerInfo: info }));
  };

  const updateSelectedStops = (stopIds: string[]) => {
    setRegistrationData((prev) => ({ ...prev, selectedStopIds: stopIds }));
  };

  const updateSelectedClub = (clubId: string) => {
    setRegistrationData((prev) => ({ ...prev, selectedClubId: clubId }));
  };

  const updateSelectedBrackets = (
    brackets: Array<{ stopId: string; bracketId: string; gameTypes: string[] }>
  ) => {
    setRegistrationData((prev) => ({ ...prev, selectedBrackets: brackets }));
  };

  // Use centralized tournament type configuration
  const tournamentIsTeam = isTeamTournament(tournament.type);
  const tournamentRequiresStopSelection = requiresStopSelection(tournament.type);
  const tournamentRequiresBracketSelection = requiresBracketSelection(tournament.type);

  // Build dynamic steps based on tournament type
  const steps = useMemo(() => {
    const stepList: Array<{ id: Step; label: string; description: string }> = [
      { id: 'info', label: 'Your Information', description: '' },
    ];

    // Add stop selection step only if required
    if (tournamentRequiresStopSelection) {
      stepList.push({ id: 'stops', label: 'Select Stops', description: '' });
    }

    // Add bracket selection step only if required
    if (tournamentRequiresBracketSelection) {
      stepList.push({ id: 'brackets', label: 'Select Brackets', description: '' });
    }

    stepList.push({ id: 'review', label: 'Review & Pay', description: '' });

    return stepList;
  }, [tournamentRequiresStopSelection, tournamentRequiresBracketSelection]);

  // Initialize with default stop if stops are not required
  useEffect(() => {
    if (!tournamentRequiresStopSelection && tournament.stops.length > 0 && registrationData.selectedStopIds.length === 0) {
      // Auto-select the default stop (should be the only one)
      setRegistrationData((prev) => ({
        ...prev,
        selectedStopIds: [tournament.stops[0].id],
      }));
    }
  }, [tournamentRequiresStopSelection, tournament.stops, registrationData.selectedStopIds.length]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-surface-1">
        {/* Header */}
        <div className="bg-surface-2 border-b border-border-subtle">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold text-primary mb-2">{tournament.name}</h1>
            <p className="text-sm text-muted">Complete your registration in 4 easy steps</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <RegistrationStepper steps={steps} currentStep={currentStep} onStepClick={goToStep} />
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 pb-12">
          <div className="bg-surface-2 border border-border-subtle rounded-lg p-6 register-form">
            {currentStep === 'info' && (
              <PlayerInfoStep
                playerInfo={registrationData.playerInfo}
                onUpdate={updatePlayerInfo}
                onNext={goToNextStep}
                onCancel={handleCancel}
                restrictionNotes={tournament.restrictionNotes}
              />
            )}

            {currentStep === 'stops' && tournamentRequiresStopSelection && (
              <StopSelectionStep
                stops={tournament.stops}
                selectedStopIds={registrationData.selectedStopIds}
                onUpdate={updateSelectedStops}
                onNext={goToNextStep}
                onBack={goToPreviousStep}
                onCancel={handleCancel}
                isTeamTournament={tournamentIsTeam}
                clubs={tournament.clubs}
                selectedClubId={registrationData.selectedClubId}
                onClubUpdate={updateSelectedClub}
              />
            )}

            {currentStep === 'brackets' && tournamentRequiresBracketSelection && (
              <BracketSelectionStep
                brackets={tournament.brackets}
                stops={tournamentRequiresStopSelection 
                  ? tournament.stops.filter((s) => registrationData.selectedStopIds.includes(s.id))
                  : tournament.stops // Use all stops if stop selection was skipped
                }
                selectedBrackets={registrationData.selectedBrackets}
                onUpdate={updateSelectedBrackets}
                onNext={goToNextStep}
                onBack={goToPreviousStep}
                onCancel={handleCancel}
                isTeamTournament={tournamentIsTeam}
              />
            )}

            {currentStep === 'review' && (
              <ReviewStep
                tournament={tournament}
                registrationData={registrationData}
                onBack={goToPreviousStep}
                onCancel={handleCancel}
                onEdit={goToStep}
              />
            )}
          </div>
        </div>

        {/* Footer Info */}
        {tournament.registrationType === 'PAID' && (
          <div className="max-w-4xl mx-auto px-4 pb-8">
            <div className="text-center text-sm text-muted">
              <p>
                Secure payment processing by Stripe • All transactions are encrypted and secure
              </p>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
