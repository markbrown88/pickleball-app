'use client';

import { useState } from 'react';
import { formatDateRangeUTC } from '@/lib/utils';

type Stop = {
  id: string;
  name: string;
  startAt: string | null;
  endAt: string | null;
  registrationDeadline: string | null;
  isRegistrationClosed: boolean;
};

type Club = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
};

type StopSelectionStepProps = {
  stops: Stop[];
  selectedStopIds: string[];
  onUpdate: (stopIds: string[]) => void;
  onNext: () => void;
  onBack: () => void;
  onCancel?: () => void;
  isTeamTournament: boolean;
  clubs: Club[];
  selectedClubId?: string;
  onClubUpdate: (clubId: string) => void;
  registeredStopIds?: string[]; // Stops the player has already registered for (paid)
  pendingStopIds?: string[]; // Stops in pending registration
};

export function StopSelectionStep({
  stops,
  selectedStopIds,
  onUpdate,
  onNext,
  onBack,
  onCancel,
  isTeamTournament,
  clubs,
  selectedClubId,
  onClubUpdate,
  registeredStopIds = [],
  pendingStopIds = [],
}: StopSelectionStepProps) {
  const [error, setError] = useState<string>('');

  const isStopAvailable = (stop: Stop): boolean => {
    // Check if stop has ended (endAt is in the past)
    if (stop.endAt) {
      const endDate = new Date(stop.endAt);
      if (endDate < new Date()) {
        return false;
      }
    } else if (stop.startAt) {
      // If no endAt, check startAt
      const startDate = new Date(stop.startAt);
      if (startDate < new Date()) {
        return false;
      }
    }
    
    if (stop.isRegistrationClosed) return false;
    if (!stop.registrationDeadline) return true;
    return new Date(stop.registrationDeadline) > new Date();
  };

  const isStopAlreadyRegistered = (stopId: string): boolean => {
    return registeredStopIds.includes(stopId);
  };

  const isStopPending = (stopId: string): boolean => {
    return pendingStopIds.includes(stopId) && !isStopAlreadyRegistered(stopId);
  };

  const toggleStop = (stopId: string) => {
    // Prevent toggling already-registered stops
    if (isStopAlreadyRegistered(stopId)) {
      return;
    }
    
    if (selectedStopIds.includes(stopId)) {
      onUpdate(selectedStopIds.filter((id) => id !== stopId));
    } else {
      onUpdate([...selectedStopIds, stopId]);
    }
    setError('');
  };

  const handleNext = () => {
    // Allow proceeding if stops are selected OR if we have pending stops (resuming pending registration)
    const hasSelectedStops = selectedStopIds.length > 0;
    const hasPendingStops = pendingStopIds.length > 0;
    
    if (!hasSelectedStops && !hasPendingStops) {
      setError('Please select at least one tournament stop');
      return;
    }

    if (isTeamTournament && !selectedClubId) {
      setError('Please select your club');
      return;
    }

    onNext();
  };

  const alreadyRegisteredStops = stops.filter(stop => isStopAlreadyRegistered(stop.id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary mb-2">Select Tournament Stops</h2>
        <p className="text-sm text-muted">
          Choose which tournament dates you'd like to attend. You can select multiple stops.
        </p>
        {alreadyRegisteredStops.length > 0 && (
          <div className="mt-3 p-3 bg-info/10 border border-info/30 rounded text-sm">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-info flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-info mb-1">You're already registered for:</p>
                <ul className="list-disc list-inside text-muted space-y-1">
                  {alreadyRegisteredStops.map(stop => (
                    <li key={stop.id}>{stop.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Club Selection (Team Tournaments Only) */}
      {isTeamTournament && clubs.length > 0 && (
        <div className="p-4 bg-surface-3 rounded">
          <label className="block text-sm font-semibold text-secondary mb-2">
            Select the club you are representing in this tournament <span className="text-error">*</span>
          </label>
          <select
            className="input w-full md:w-96"
            value={selectedClubId || ''}
            onChange={(e) => onClubUpdate(e.target.value)}
          >
            <option value="">-- Choose a club --</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
                {club.city && club.region && ` (${club.city}, ${club.region})`}
                {club.city && !club.region && ` (${club.city})`}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted mt-2">
            Note: You'll play for this club in all the stops you select below.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-error/10 border border-error text-error text-sm rounded flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Stops List */}
      <div className="space-y-3">
        {stops.length === 0 ? (
          <div className="p-8 bg-surface-3 border border-border-subtle rounded text-center">
            <p className="text-muted">No tournament stops have been configured yet.</p>
          </div>
        ) : (
          stops.map((stop) => {
            const available = isStopAvailable(stop);
            const alreadyRegistered = isStopAlreadyRegistered(stop.id);
            const isPending = isStopPending(stop.id);
            const selected = selectedStopIds.includes(stop.id) || isPending;
            const canSelect = available && !alreadyRegistered && !isPending;

            return (
              <div
                key={stop.id}
                className={`
                  relative p-4 rounded transition-all
                  ${
                    selected
                      ? 'bg-primary/5 ring-2 ring-primary/20'
                      : canSelect
                        ? 'bg-surface-3 hover:ring-1 hover:ring-primary/50 cursor-pointer'
                        : 'bg-surface-3 opacity-60 cursor-not-allowed'
                  }
                `}
                onClick={() => canSelect && toggleStop(stop.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selected && !alreadyRegistered} // Show as checked if selected or pending (but not already registered)
                      onChange={() => {}} // Handled by parent div click
                      disabled={!canSelect}
                      className="w-5 h-5 cursor-pointer"
                      readOnly={isPending} // Read-only for pending stops
                    />
                  </div>

                  {/* Stop Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-secondary text-lg">{stop.name}</h3>
                        <p className="text-sm text-muted mt-1">
                          {formatDateRangeUTC(stop.startAt, stop.endAt)}
                        </p>
                      </div>

                      {/* Status Badge */}
                      {alreadyRegistered && (
                        <span className="px-3 py-1 bg-success/20 text-success text-xs font-semibold rounded">
                          Already Registered
                        </span>
                      )}
                      {isPending && !alreadyRegistered && (
                        <span className="px-3 py-1 bg-warning/20 text-warning text-xs font-semibold rounded">
                          Payment Pending
                        </span>
                      )}
                      {!available && !alreadyRegistered && !isPending && (
                        <span className="px-3 py-1 bg-error/20 text-error text-xs font-semibold rounded">
                          {(() => {
                            // Check if stop has ended
                            if (stop.endAt && new Date(stop.endAt) < new Date()) {
                              return 'Ended';
                            }
                            if (stop.startAt && !stop.endAt && new Date(stop.startAt) < new Date()) {
                              return 'Ended';
                            }
                            // Otherwise check registration status
                            return stop.isRegistrationClosed ? 'Closed' : 'Deadline Passed';
                          })()}
                        </span>
                      )}
                    </div>

                    {/* Registration Deadline */}
                    {available && stop.registrationDeadline && (
                      <div className="mt-2 text-xs text-muted flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          Registration closes: {formatDateRangeUTC(stop.registrationDeadline, null)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selection Summary */}
      {selectedStopIds.length > 0 && (
        <div className="p-4 bg-success/10 border border-success/30 rounded">
          <div className="flex items-center gap-2 text-success">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold">
              {selectedStopIds.length} stop{selectedStopIds.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <p className="text-sm text-secondary mt-1 ml-7">
            You will select brackets for each selected stop in the next step.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-4 border-t border-border-subtle">
        <div className="flex gap-3">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn btn-ghost">
              Cancel
            </button>
          )}
          <button type="button" onClick={onBack} className="btn btn-ghost">
            Back
          </button>
        </div>
        <button type="button" onClick={handleNext} className="btn btn-primary px-8">
          Continue to Bracket Selection
        </button>
      </div>
    </div>
  );
}
