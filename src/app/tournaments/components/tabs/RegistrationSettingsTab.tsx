'use client';

import { useState, useEffect } from 'react';
import type { EditorRow } from '../TournamentEditor';
import { isTeamTournament, getAllowedPricingModels } from '@/lib/tournamentTypeConfig';

type RegistrationStatus = 'OPEN' | 'INVITE_ONLY' | 'CLOSED';
type RegistrationType = 'FREE' | 'PAID';
type PricingModel = 'TOURNAMENT_WIDE' | 'PER_STOP' | 'PER_BRACKET' | 'PER_STOP_PER_BRACKET';

// Extend EditorRow to include registration fields
export type EditorRowWithRegistration = EditorRow & {
  registrationStatus: RegistrationStatus;
  registrationType: RegistrationType;
  registrationCost: string; // stored as string for input, converted to cents
  pricingModel: PricingModel; // NEW: pricing model selection
  maxPlayers: string; // stored as string for input
  restrictionNotes: string[];
  isWaitlistEnabled: boolean;
};

type RegistrationSettingsTabProps = {
  editor: EditorRowWithRegistration;
  setEditor: (editor: EditorRowWithRegistration) => void;
};

export function RegistrationSettingsTab({ editor, setEditor }: RegistrationSettingsTabProps) {
  const [newRestriction, setNewRestriction] = useState('');

  // Get allowed pricing models for this tournament type
  const allowedPricingModels = getAllowedPricingModels(editor.type);
  const tournamentIsTeam = isTeamTournament(editor.type);

  // Auto-reset invalid pricing models
  useEffect(() => {
    if (!allowedPricingModels.includes(editor.pricingModel)) {
      // Reset to first allowed pricing model (should be TOURNAMENT_WIDE)
      setEditor({ ...editor, pricingModel: allowedPricingModels[0] || 'TOURNAMENT_WIDE' });
    }
  }, [editor.type]); // Only run when tournament type changes

  const updateField = <K extends keyof EditorRowWithRegistration>(
    field: K,
    value: EditorRowWithRegistration[K]
  ) => {
    setEditor({ ...editor, [field]: value });
  };

  const addRestriction = () => {
    const trimmed = newRestriction.trim();
    if (!trimmed) return;

    updateField('restrictionNotes', [...editor.restrictionNotes, trimmed]);
    setNewRestriction('');
  };

  const removeRestriction = (index: number) => {
    const updated = [...editor.restrictionNotes];
    updated.splice(index, 1);
    updateField('restrictionNotes', updated);
  };

  const formatCurrency = (value: string): string => {
    // Remove non-numeric characters except decimal point
    const cleaned = value.replace(/[^\d.]/g, '');

    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].slice(0, 2);
    }

    return cleaned;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Registration Status */}
      <div>
        <h3 className="text-lg font-semibold text-primary mb-4">Registration Status</h3>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="registrationStatus"
              className="mt-1"
              checked={editor.registrationStatus === 'OPEN'}
              onChange={() => updateField('registrationStatus', 'OPEN')}
            />
            <div>
              <div className="font-medium text-secondary">Open for Registration</div>
              <p className="text-xs text-muted">
                Any player can register for this tournament (subject to restrictions you define below)
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="registrationStatus"
              className="mt-1"
              checked={editor.registrationStatus === 'INVITE_ONLY'}
              onChange={() => updateField('registrationStatus', 'INVITE_ONLY')}
            />
            <div>
              <div className="font-medium text-secondary">Invite Only</div>
              <p className="text-xs text-muted">
                Only invited players or approved invite requests can register
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="registrationStatus"
              className="mt-1"
              checked={editor.registrationStatus === 'CLOSED'}
              onChange={() => updateField('registrationStatus', 'CLOSED')}
            />
            <div>
              <div className="font-medium text-secondary">Closed</div>
              <p className="text-xs text-muted">
                No new registrations accepted (tournament is full or registration period ended)
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Registration Type */}
      <div className="border-t border-border-subtle pt-6">
        <h3 className="text-lg font-semibold text-primary mb-4">Registration Type</h3>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="registrationType"
              className="mt-1"
              checked={editor.registrationType === 'FREE'}
              onChange={() => updateField('registrationType', 'FREE')}
            />
            <div>
              <div className="font-medium text-secondary">Free</div>
              <p className="text-xs text-muted">
                No payment required to register for this tournament
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="registrationType"
              className="mt-1"
              checked={editor.registrationType === 'PAID'}
              onChange={() => updateField('registrationType', 'PAID')}
            />
            <div>
              <div className="font-medium text-secondary">Paid</div>
              <p className="text-xs text-muted">
                Players must pay to complete their registration
              </p>
            </div>
          </label>
        </div>

        {editor.registrationType === 'PAID' && (
          <div className="mt-4">
            <label className="block text-sm font-semibold text-secondary mb-2">
              Registration Cost (per player) <span className="text-error">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg text-secondary">$</span>
              <input
                type="text"
                className="input w-32"
                value={editor.registrationCost}
                onChange={(e) => updateField('registrationCost', formatCurrency(e.target.value))}
                placeholder="45.00"
              />
            </div>
            <p className="text-xs text-muted mt-1">
              Amount will be charged via Stripe when players register (+HST)
            </p>
          </div>
        )}
      </div>

      {/* Pricing Model */}
      {editor.registrationType === 'PAID' && (
        <div className="border-t border-border-subtle pt-6">
          <h3 className="text-lg font-semibold text-primary mb-4">Pricing Model</h3>
          <p className="text-sm text-muted mb-4">
            Choose how players will be charged for this tournament. This determines pricing flexibility for stops and brackets, as applicable for the selected Tournament Type.
          </p>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="pricingModel"
                className="mt-1"
                checked={editor.pricingModel === 'TOURNAMENT_WIDE'}
                onChange={() => updateField('pricingModel', 'TOURNAMENT_WIDE')}
              />
              <div>
                <div className="font-medium text-secondary">Tournament-Wide Pricing</div>
                <p className="text-xs text-muted">
                  One flat fee covers the entire tournament (all stops, all game types).
                </p>
              </div>
            </label>

            {allowedPricingModels.includes('PER_STOP') && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="pricingModel"
                  className="mt-1"
                  checked={editor.pricingModel === 'PER_STOP'}
                  onChange={() => updateField('pricingModel', 'PER_STOP')}
                />
                <div>
                  <div className="font-medium text-secondary">Per-Stop Pricing</div>
                  <p className="text-xs text-muted">
                    Players pay separately for each stop they register for.
                  </p>
                </div>
              </label>
            )}

            {allowedPricingModels.includes('PER_BRACKET') && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="pricingModel"
                  className="mt-1"
                  checked={editor.pricingModel === 'PER_BRACKET'}
                  onChange={() => updateField('pricingModel', 'PER_BRACKET')}
                />
                <div>
                  <div className="font-medium text-secondary">Per-Bracket Pricing</div>
                  <p className="text-xs text-muted">
                    Different price for each game type/bracket. Best for individual tournaments where singles, doubles, and mixed have different costs.
                  </p>
                </div>
              </label>
            )}

            {allowedPricingModels.includes('PER_STOP_PER_BRACKET') && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="pricingModel"
                  className="mt-1"
                  checked={editor.pricingModel === 'PER_STOP_PER_BRACKET'}
                  onChange={() => updateField('pricingModel', 'PER_STOP_PER_BRACKET')}
                />
                <div>
                  <div className="font-medium text-secondary">Per-Stop Per-Bracket Pricing</div>
                  <p className="text-xs text-muted">
                    Maximum flexibility - different price for each stop AND bracket combination. Use for complex tournaments with varying costs.
                  </p>
                </div>
              </label>
            )}
          </div>

          {editor.pricingModel === 'PER_STOP' && (
            <div className="mt-4 p-3 bg-surface-2 border border-border-subtle rounded">
              <p className="text-sm text-secondary">
                <strong>Note:</strong> Advanced pricing configuration will be available after you save this tournament. You'll be able to set specific prices per stop.
              </p>
            </div>
          )}

          {editor.pricingModel !== 'TOURNAMENT_WIDE' && editor.pricingModel !== 'PER_STOP' && (
            <div className="mt-4 p-3 bg-surface-2 border border-border-subtle rounded">
              <p className="text-sm text-secondary">
                <strong>Note:</strong> Advanced pricing configuration will be available after you save this tournament.
                You'll be able to set specific prices per {editor.pricingModel === 'PER_BRACKET' ? 'bracket' : 'stop and bracket'}.
              </p>
            </div>
          )}

          {/* Show warning if invalid pricing model is selected */}
          {!allowedPricingModels.includes(editor.pricingModel) && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded">
              <p className="text-sm text-warning">
                <strong>Invalid pricing model:</strong> This pricing model is not available for {editor.type} tournaments. 
                Please select one of the allowed pricing models above.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Player Limit */}
      <div className="border-t border-border-subtle pt-6">
        <h3 className="text-lg font-semibold text-primary mb-4">Player Limit</h3>
        <div>
          <label className="block text-sm font-semibold text-secondary mb-2">
            Maximum Players
          </label>
          <input
            type="text"
            className="input w-32"
            value={editor.maxPlayers}
            onChange={(e) => {
              const value = e.target.value.replace(/[^\d]/g, '');
              updateField('maxPlayers', value);
            }}
            placeholder="32"
          />
          <p className="text-xs text-muted mt-1">
            Leave blank for unlimited. When limit is reached, new registrations will join the waitlist.
          </p>
        </div>

        {editor.maxPlayers && (
          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editor.isWaitlistEnabled}
                onChange={(e) => updateField('isWaitlistEnabled', e.target.checked)}
              />
              <div>
                <span className="font-medium text-secondary">Enable Waitlist</span>
                <p className="text-xs text-muted">
                  Allow players to join a waitlist when the tournament is full
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Restrictions */}
      <div className="border-t border-border-subtle pt-6">
        <h3 className="text-lg font-semibold text-primary mb-2">Restrictions & Requirements</h3>
        <p className="text-sm text-muted mb-4">
          These are informational only - they will be displayed to players, but you can manually accept or reject any registration.
        </p>

        {editor.restrictionNotes.length > 0 && (
          <div className="space-y-2 mb-4">
            {editor.restrictionNotes.map((note, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-surface-2 border border-border-subtle rounded"
              >
                <div className="flex items-start gap-2">
                  <span className="text-secondary mt-0.5">•</span>
                  <span className="text-sm text-primary">{note}</span>
                </div>
                <button
                  className="text-error hover:text-error-hover text-sm ml-4"
                  onClick={() => removeRestriction(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1"
            value={newRestriction}
            onChange={(e) => setNewRestriction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addRestriction();
              }
            }}
            placeholder="e.g., Must be 18+ years old, Skill level 3.0+ recommended"
          />
          <button
            className="btn btn-secondary"
            onClick={addRestriction}
            disabled={!newRestriction.trim()}
          >
            Add
          </button>
        </div>
        <p className="text-xs text-muted mt-2">
          Examples: "Must be 18+ years old", "Skill level 3.0 or higher", "Seattle club members only"
        </p>
      </div>

      {/* Summary */}
      <div className="bg-surface-2 border border-border-subtle rounded p-4">
        <h4 className="font-semibold text-secondary mb-2 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Registration Summary
        </h4>
        <ul className="text-sm text-muted space-y-1">
          <li>
            • Status:{' '}
            <span className="font-medium text-secondary">
              {editor.registrationStatus === 'OPEN' && 'Open for Registration'}
              {editor.registrationStatus === 'INVITE_ONLY' && 'Invite Only'}
              {editor.registrationStatus === 'CLOSED' && 'Closed'}
            </span>
          </li>
          <li>
            • Cost:{' '}
            <span className="font-medium text-secondary">
              {editor.registrationType === 'FREE'
                ? 'Free'
                : editor.registrationCost
                  ? `$${editor.registrationCost} per player`
                  : 'Paid (cost not set)'}
            </span>
          </li>
          {editor.registrationType === 'PAID' && (
            <li>
              • Pricing Model:{' '}
              <span className="font-medium text-secondary">
                {editor.pricingModel === 'TOURNAMENT_WIDE' && 'Tournament-Wide'}
                {editor.pricingModel === 'PER_STOP' && 'Per-Stop'}
                {editor.pricingModel === 'PER_BRACKET' && 'Per-Bracket'}
                {editor.pricingModel === 'PER_STOP_PER_BRACKET' && 'Per-Stop Per-Bracket'}
              </span>
            </li>
          )}
          <li>
            • Player Limit:{' '}
            <span className="font-medium text-secondary">
              {editor.maxPlayers ? `${editor.maxPlayers} players` : 'Unlimited'}
            </span>
          </li>
          <li>
            • Waitlist:{' '}
            <span className="font-medium text-secondary">
              {editor.maxPlayers && editor.isWaitlistEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </li>
          {editor.restrictionNotes.length > 0 && (
            <li>
              • Restrictions:{' '}
              <span className="font-medium text-secondary">
                {editor.restrictionNotes.length} requirement(s)
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
