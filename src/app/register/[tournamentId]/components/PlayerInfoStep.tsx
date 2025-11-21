'use client';

import { useState } from 'react';
import { formatPhoneInput } from '@/lib/phone';

export type PlayerInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: 'MALE' | 'FEMALE' | '';
};

type PlayerInfoStepProps = {
  playerInfo: PlayerInfo;
  onUpdate: (info: PlayerInfo) => void;
  onNext: () => void;
  onCancel?: () => void;
  restrictionNotes: string[];
};

export function PlayerInfoStep({
  playerInfo,
  onUpdate,
  onNext,
  onCancel,
  restrictionNotes,
}: PlayerInfoStepProps) {
  const [errors, setErrors] = useState<Partial<Record<keyof PlayerInfo, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof PlayerInfo, string>> = {};

    if (!playerInfo.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!playerInfo.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!playerInfo.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(playerInfo.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone is optional - only validate format if provided
    if (playerInfo.phone?.trim() && !/^[\d\s\-\+\(\)]+$/.test(playerInfo.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    // Gender is required
    if (!playerInfo.gender) {
      newErrors.gender = 'Gender selection is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onNext();
    }
  };

  const updateField = (field: keyof PlayerInfo, value: string) => {
    const nextValue = field === 'phone' ? formatPhoneInput(value) : value;
    onUpdate({ ...playerInfo, [field]: nextValue });
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary mb-2">Your Information</h2>
        <p className="text-sm text-muted">
          Please verify your contact information. This will be used to communicate important
          tournament updates.
        </p>
      </div>

      {/* Tournament Restrictions */}
      {restrictionNotes.length > 0 && (
        <div className="p-4 bg-warning/10 border border-warning/30 rounded">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-warning flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <div className="text-sm font-semibold text-warning mb-2">
                Tournament Requirements
              </div>
              <ul className="text-sm text-secondary space-y-1">
                {restrictionNotes.map((note, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-1.5">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* First Name */}
        <div>
          <label className="block text-sm font-semibold text-secondary mb-2">
            First Name <span className="text-error">*</span>
          </label>
          <input
            type="text"
            className={`input w-full ${errors.firstName ? 'border-error' : ''}`}
            value={playerInfo.firstName || ''}
            onChange={(e) => updateField('firstName', e.target.value)}
            placeholder="John"
          />
          {errors.firstName && (
            <p className="text-xs text-error mt-1">{errors.firstName}</p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-sm font-semibold text-secondary mb-2">
            Last Name <span className="text-error">*</span>
          </label>
          <input
            type="text"
            className={`input w-full ${errors.lastName ? 'border-error' : ''}`}
            value={playerInfo.lastName || ''}
            onChange={(e) => updateField('lastName', e.target.value)}
            placeholder="Doe"
          />
          {errors.lastName && <p className="text-xs text-error mt-1">{errors.lastName}</p>}
        </div>
      </div>

      {/* Email, Phone, and Gender on same line */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-secondary mb-2">
            Email Address <span className="text-error">*</span>
          </label>
          <input
            type="email"
            className={`input w-full ${errors.email ? 'border-error' : ''}`}
            value={playerInfo.email || ''}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="john.doe@example.com"
          />
          {errors.email && <p className="text-xs text-error mt-1">{errors.email}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-semibold text-secondary mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            className={`input w-full ${errors.phone ? 'border-error' : ''}`}
            value={playerInfo.phone || ''}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="(555) 123-4567"
          />
          {errors.phone && <p className="text-xs text-error mt-1">{errors.phone}</p>}
        </div>

        {/* Gender */}
        <div>
          <label className="block text-sm font-semibold text-secondary mb-2">
            Sex <span className="text-error">*</span>
          </label>
          <div className="flex gap-2">
            {(['MALE', 'FEMALE'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => updateField('gender', value)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  playerInfo.gender === value
                    ? 'shadow-md text-white'
                    : 'opacity-50 hover:opacity-75 bg-gray-100 text-gray-700'
                } ${errors.gender ? 'border-2 border-error' : ''}`}
                style={{
                  backgroundColor: playerInfo.gender === value
                    ? (value === 'MALE' ? '#3b82f6' : '#db2777')
                    : undefined
                }}
              >
                {value === 'MALE' ? 'Male' : 'Female'}
              </button>
            ))}
          </div>
          {errors.gender && <p className="text-xs text-error mt-1">{errors.gender}</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-4 border-t border-border-subtle">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary px-8 ml-auto">
          Continue to Stop Selection
        </button>
      </div>
    </form>
  );
}
