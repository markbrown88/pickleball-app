'use client';

import { useState } from 'react';
import { formatDateRangeUTC } from '@/lib/utils';
import { fetchWithActAs } from '@/lib/fetchWithActAs';

type Stop = {
  id: string;
  name: string;
  startAt: string | null;
  endAt: string | null;
};

type Bracket = {
  id: string;
  name: string;
  idx: number;
};

type Club = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
};

type TournamentData = {
  id: string;
  name: string;
  type: string;
  registrationType: string;
  registrationCost: number | null;
  pricingModel: string;
  stops: Stop[];
  brackets: Bracket[];
  clubs: Club[];
};

type RegistrationData = {
  playerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  selectedStopIds: string[];
  selectedClubId?: string;
  selectedBrackets: Array<{
    stopId: string;
    bracketId: string;
    gameTypes: string[];
  }>;
};

type ReviewStepProps = {
  tournament: TournamentData;
  registrationData: RegistrationData;
  onBack: () => void;
  onCancel?: () => void;
  onEdit: (step: 'info' | 'stops' | 'brackets') => void;
};

const GAME_TYPES_TEAM = [
  { id: 'MENS_DOUBLES', label: "Men's Doubles", abbr: 'MD' },
  { id: 'WOMENS_DOUBLES', label: "Women's Doubles", abbr: 'WD' },
  { id: 'MIXED_DOUBLES_1', label: 'Mixed Doubles 1', abbr: 'Mix1' },
  { id: 'MIXED_DOUBLES_2', label: 'Mixed Doubles 2', abbr: 'Mix2' },
  { id: 'MENS_SINGLES', label: "Men's Singles", abbr: 'MS' },
  { id: 'WOMENS_SINGLES', label: "Women's Singles", abbr: 'WS' },
];

const GAME_TYPES_INDIVIDUAL = [
  { id: 'MENS_DOUBLES', label: "Men's Doubles", abbr: 'MD' },
  { id: 'WOMENS_DOUBLES', label: "Women's Doubles", abbr: 'WD' },
  { id: 'MIXED_DOUBLES', label: 'Mixed Doubles', abbr: 'Mix' },
  { id: 'MENS_SINGLES', label: "Men's Singles", abbr: 'MS' },
  { id: 'WOMENS_SINGLES', label: "Women's Singles", abbr: 'WS' },
];

export function ReviewStep({ tournament, registrationData, onBack, onCancel, onEdit }: ReviewStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const isTeamTournament = tournament.type === 'TEAM_FORMAT';
  const gameTypes = isTeamTournament ? GAME_TYPES_TEAM : GAME_TYPES_INDIVIDUAL;

  const selectedStops = tournament.stops.filter((stop) =>
    registrationData.selectedStopIds.includes(stop.id)
  );

  const selectedClub = tournament.clubs.find(
    (club) => club.id === registrationData.selectedClubId
  );

  // Calculate pricing
  // Note: tournament.registrationCost is stored in cents, convert to dollars for display
  const calculatePrice = (): number => {
    if (tournament.registrationType === 'FREE') {
      return 0;
    }

    // Convert from cents to dollars
    const baseCostInDollars = tournament.registrationCost ? tournament.registrationCost / 100 : 0;

    switch (tournament.pricingModel) {
      case 'PER_TOURNAMENT':
      case 'TOURNAMENT_WIDE':
        return baseCostInDollars;

      case 'PER_STOP':
        return baseCostInDollars * registrationData.selectedStopIds.length;

      case 'PER_BRACKET':
        // Count unique bracket selections across all stops
        const uniqueBrackets = new Set(
          registrationData.selectedBrackets.map((sb) => sb.bracketId)
        );
        return baseCostInDollars * uniqueBrackets.size;

      case 'PER_GAME_TYPE':
        // Count total game type selections
        const totalGameTypes = registrationData.selectedBrackets.reduce(
          (sum, sb) => sum + sb.gameTypes.length,
          0
        );
        return baseCostInDollars * totalGameTypes;

      default:
        return baseCostInDollars;
    }
  };

  const totalCost = calculatePrice();

  const getGameTypeLabel = (gameTypeId: string): string => {
    const gameType = gameTypes.find((gt) => gt.id === gameTypeId);
    return gameType?.label || gameTypeId;
  };

  const getBracketName = (bracketId: string): string => {
    const bracket = tournament.brackets.find((b) => b.id === bracketId);
    return bracket?.name || 'Unknown Bracket';
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetchWithActAs('/api/registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tournamentId: tournament.id,
          playerInfo: registrationData.playerInfo,
          selectedStopIds: registrationData.selectedStopIds,
          selectedClubId: registrationData.selectedClubId,
          selectedBrackets: registrationData.selectedBrackets,
        }),
      });

      // Check if response is ok first
      if (!response.ok) {
        let data: any = {};
        try {
          const text = await response.text();
          console.error('Registration error - Response status:', response.status, response.statusText);
          console.error('Registration error - Response text (raw):', text);
          
          if (text) {
            try {
              // Try parsing the text as JSON
              data = JSON.parse(text);
              console.error('Registration error - Parsed data:', data);
            } catch (parseError) {
              console.error('Failed to parse error response as JSON:', parseError);
              // If parsing fails, use the raw text as the error message
              data = { error: text || `Server error (${response.status})` };
            }
          } else {
            data = { error: `Server returned empty response (${response.status})` };
          }
        } catch (error) {
          console.error('Failed to read error response:', error);
          data = { error: `Failed to read server response (${response.status})` };
        }
        
        const errorMsg = data.details 
          ? `${data.error || 'Error'}: ${data.details}`
          : data.error || `Failed to submit registration (${response.status})`;
        
        console.error('Registration error response (final):', {
          status: response.status,
          statusText: response.statusText,
          data,
          errorMsg,
        });
        
        // Show more helpful error message
        if (data.supportUrl) {
          setError(`${errorMsg} Need help? Contact support.`);
        } else {
          setError(errorMsg);
        }
        return;
      }

      // Parse successful response
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse registration response:', jsonError);
        const text = await response.text();
        console.error('Response text:', text);
        setError(`Failed to parse server response: ${response.status} ${response.statusText}`);
        return;
      }

      // Registration successful
      if (tournament.registrationType === 'PAID') {
        // Create Stripe Checkout session for payment
        const paymentResponse = await fetchWithActAs('/api/payments/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            registrationId: data.registrationId,
          }),
        });

        const paymentData = await paymentResponse.json();

        if (!paymentResponse.ok) {
          const errorMsg = paymentData.details 
            ? `${paymentData.error}: ${paymentData.details}`
            : paymentData.error || 'Failed to create payment session';
          
          if (paymentData.supportUrl) {
            throw new Error(`${errorMsg} Need help? Contact support.`);
          } else {
            throw new Error(errorMsg);
          }
        }

        // Redirect to Stripe Checkout
        if (paymentData.url) {
          window.location.href = paymentData.url;
        } else {
          throw new Error('No payment URL received');
        }
      } else {
        // Free tournament - redirect to confirmation page
        window.location.href = `/register/${tournament.id}/confirmation?registrationId=${data.registrationId}`;
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit registration. Please try again.';
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary mb-2">Review Your Registration</h2>
        <p className="text-sm text-muted">
          Please review your information carefully before completing your registration.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-error/10 border border-error text-error text-sm rounded flex items-start gap-2">
          <svg
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Player Information */}
      <div className="rounded-lg p-4 bg-surface-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-secondary">Your Information</h3>
          <button
            type="button"
            onClick={() => onEdit('info')}
            className="text-sm text-primary hover:underline"
          >
            Edit
          </button>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted w-20">Name:</span>
            <span className="text-secondary font-medium">
              {registrationData.playerInfo.firstName} {registrationData.playerInfo.lastName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted w-20">Email:</span>
            <span className="text-secondary">{registrationData.playerInfo.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted w-20">Phone:</span>
            <span className="text-secondary">{registrationData.playerInfo.phone}</span>
          </div>
        </div>
      </div>

      {/* Tournament Selections */}
      <div className="rounded-lg p-4 bg-surface-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-secondary">Tournament Selections</h3>
          <button
            type="button"
            onClick={() => onEdit('stops')}
            className="text-sm text-primary hover:underline"
          >
            Edit
          </button>
        </div>
        <div className="space-y-2">
          {isTeamTournament && selectedClub && (
            <div className="text-sm">
              <span className="text-muted">Representing Club:</span>{' '}
              <span className="text-secondary font-medium">
                {selectedClub.name}
                {selectedClub.city && selectedClub.region && (
                  <span className="text-muted">
                    ({selectedClub.city}, {selectedClub.region})
                  </span>
                )}
              </span>
            </div>
          )}
          <div className="text-sm">
            <span className="text-muted font-semibold">Stops:</span>
          </div>
          <div className="space-y-1 pl-6">
            {selectedStops.map((stop) => {
              const selectionsForStop = registrationData.selectedBrackets.filter(
                (sb) => sb.stopId === stop.id
              );
              const selectedBracket = selectionsForStop.length > 0 
                ? getBracketName(selectionsForStop[0].bracketId)
                : 'Not selected';

              return (
                <div key={stop.id} className="text-sm">
                  {'\u00A0\u00A0\u00A0\u00A0\u00A0'}
                  <span className="text-secondary font-medium">{stop.name}</span>
                  {(stop.startAt || stop.endAt) && (
                    <>
                      {'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}
                      <span className="text-xs text-muted">
                        ({formatDateRangeUTC(stop.startAt, stop.endAt)})
                      </span>
                    </>
                  )}
                  {'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}
                  <span className="text-muted">Bracket:</span>{' '}
                  <span className="text-secondary">{selectedBracket}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pricing Breakdown */}
      {tournament.registrationType === 'PAID' && (
        <div className="rounded-lg p-4 bg-surface-3">
          <h3 className="text-lg font-semibold text-secondary mb-4">Pricing</h3>
          <div className="space-y-2 text-sm">
            {(() => {
              // Convert registrationCost from cents to dollars for display
              const costInDollars = tournament.registrationCost ? (tournament.registrationCost / 100).toFixed(2) : '0.00';
              
              if (tournament.pricingModel === 'PER_TOURNAMENT' || tournament.pricingModel === 'TOURNAMENT_WIDE') {
                return (
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Tournament Registration:</span>
                    <span className="text-secondary">${costInDollars}</span>
                  </div>
                );
              }

              if (tournament.pricingModel === 'PER_STOP') {
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Price per stop:</span>
                      <span className="text-secondary">${costInDollars}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Number of stops:</span>
                      <span className="text-secondary">{registrationData.selectedStopIds.length}</span>
                    </div>
                  </>
                );
              }

              if (tournament.pricingModel === 'PER_BRACKET') {
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Price per bracket:</span>
                      <span className="text-secondary">${costInDollars}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Number of brackets:</span>
                      <span className="text-secondary">
                        {new Set(registrationData.selectedBrackets.map((sb) => sb.bracketId)).size}
                      </span>
                    </div>
                  </>
                );
              }

              if (tournament.pricingModel === 'PER_GAME_TYPE') {
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Price per game type:</span>
                      <span className="text-secondary">${costInDollars}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Number of game types:</span>
                      <span className="text-secondary">
                        {registrationData.selectedBrackets.reduce(
                          (sum, sb) => sum + sb.gameTypes.length,
                          0
                        )}
                      </span>
                    </div>
                  </>
                );
              }

              return null;
            })()}

            <div className="pt-3 mt-3 border-t border-border-subtle">
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="text-secondary">Total:</span>
                <span className="text-primary">${totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Free Tournament Notice */}
      {tournament.registrationType === 'FREE' && (
        <div className="p-4 bg-success/10 border border-success/30 rounded">
          <div className="flex items-center gap-2 text-success">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-semibold">Free Registration</span>
          </div>
          <p className="text-sm text-secondary mt-1">
            This tournament is free to enter. Click below to complete your registration.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-4 border-t border-border-subtle">
        <div className="flex gap-3">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={isSubmitting}>
              Cancel
            </button>
          )}
          <button type="button" onClick={onBack} className="btn btn-ghost" disabled={isSubmitting}>
            Back
          </button>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          className="btn btn-primary px-8"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </span>
          ) : tournament.registrationType === 'PAID' ? (
            'Proceed to Payment'
          ) : (
            'Complete Registration'
          )}
        </button>
      </div>
    </div>
  );
}
