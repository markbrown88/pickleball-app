'use client';

import { useState } from 'react';
import { formatDateRangeUTC } from '@/lib/utils';

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

type SelectedBracket = {
  stopId: string;
  bracketId: string;
  gameTypes: string[];
};

type BracketSelectionStepProps = {
  brackets: Bracket[];
  stops: Stop[];
  selectedBrackets: SelectedBracket[];
  onUpdate: (brackets: SelectedBracket[]) => void;
  onNext: () => void;
  onBack: () => void;
  onCancel?: () => void;
  isTeamTournament: boolean;
};

export function BracketSelectionStep({
  brackets,
  stops,
  selectedBrackets,
  onUpdate,
  onNext,
  onBack,
  onCancel,
  isTeamTournament,
}: BracketSelectionStepProps) {
  const [error, setError] = useState<string>('');

  // Get selected bracket for a stop
  const getSelectedBracketForStop = (stopId: string): string | null => {
    const selection = selectedBrackets.find((sb) => sb.stopId === stopId);
    return selection?.bracketId || null;
  };

  // Handle bracket selection for a stop
  const handleBracketChange = (stopId: string, bracketId: string) => {
    // Get all game types (for team tournaments, all 6; for individual, we'll use all available)
    const allGameTypes = [
      'MENS_DOUBLES',
      'WOMENS_DOUBLES',
      'MIXED_DOUBLES_1',
      'MIXED_DOUBLES_2',
      'MENS_SINGLES',
      'WOMENS_SINGLES',
    ];

    // Remove existing selection for this stop
    const updated = selectedBrackets.filter((sb) => sb.stopId !== stopId);

    // Add new selection
    if (bracketId) {
      updated.push({
        stopId,
        bracketId,
        gameTypes: allGameTypes,
      });
    }

    onUpdate(updated);
    setError('');
  };

  const handleNext = () => {
    // Validate that each stop has a bracket selected
    for (const stop of stops) {
      const selectedBracket = getSelectedBracketForStop(stop.id);
      if (!selectedBracket) {
        setError(`Please select a bracket for ${stop.name}`);
        return;
      }
    }

    onNext();
  };

  const isSingleStop = stops.length === 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary mb-2">
          {isSingleStop ? 'Select Bracket' : 'Select Brackets'}
        </h2>
        <p className="text-sm text-muted">
          {isSingleStop ? 'Select your bracket level' : 'Select one bracket per stop.'}
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

      {/* Stops */}
      <div className="space-y-4">
        {stops.map((stop) => {
          const selectedBracket = getSelectedBracketForStop(stop.id);

          return (
            <div key={stop.id} className="space-y-2">
              {!isSingleStop && (
                <label className="block text-sm font-semibold text-secondary">
                  {stop.name}
                  {(stop.startAt || stop.endAt) && (
                    <span className="text-xs text-muted font-normal ml-2">
                      {formatDateRangeUTC(stop.startAt, stop.endAt)}
                    </span>
                  )}
                </label>
              )}
              <select
                className="input w-full md:w-96"
                value={selectedBracket || ''}
                onChange={(e) => handleBracketChange(stop.id, e.target.value)}
              >
                <option value="">-- Select a bracket --</option>
                {brackets.map((bracket) => (
                  <option key={bracket.id} value={bracket.id}>
                    {bracket.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

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
        <button type="button" onClick={handleNext} className="btn btn-secondary px-8">
          Continue to Review
        </button>
      </div>
    </div>
  );
}
