'use client';

import { useState } from 'react';
import type { EditorRow } from '../TournamentEditor';

type RegistrationStatus = 'OPEN' | 'INVITE_ONLY' | 'CLOSED';
type RegistrationType = 'FREE' | 'PAID';

// Extend EditorRow to include registration fields
export type EditorRowWithRegistration = EditorRow & {
  registrationStatus: RegistrationStatus;
  registrationType: RegistrationType;
  registrationCost: string; // stored as string for input, converted to cents
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
              Amount will be charged via Stripe when players register
            </p>
          </div>
        )}
      </div>

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
