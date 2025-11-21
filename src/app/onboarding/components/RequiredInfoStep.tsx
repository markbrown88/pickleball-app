'use client';

import { useState } from 'react';
import { GenderSelector } from '@/components/GenderSelector';

type Club = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
};

type RequiredInfoData = {
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  clubId: string;
  email: string;
};

type RequiredInfoStepProps = {
  formData: RequiredInfoData;
  clubs: Club[];
  onUpdate: (updates: Partial<RequiredInfoData>) => void;
  onNext: () => void;
};

export function RequiredInfoStep({ formData, clubs, onUpdate, onNext }: RequiredInfoStepProps) {
  const [errors, setErrors] = useState<Partial<Record<keyof RequiredInfoData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof RequiredInfoData, string>> = {};

    if (!formData.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.gender || (formData.gender !== 'MALE' && formData.gender !== 'FEMALE')) {
      newErrors.gender = 'Gender selection is required';
    }

    if (!formData.clubId) {
      newErrors.clubId = 'Club selection is required';
    }

    if (!formData.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
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

  const updateField = (field: keyof RequiredInfoData, value: string) => {
    onUpdate({ [field]: value });
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
        <h2 className="text-xl font-bold text-primary mb-2">Required Information</h2>
        <p className="text-sm text-muted">
          Please provide your basic information. This is required to create your player profile.
        </p>
      </div>

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
            value={formData.firstName}
            onChange={(e) => updateField('firstName', e.target.value)}
            placeholder="John"
            required
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
            value={formData.lastName}
            onChange={(e) => updateField('lastName', e.target.value)}
            placeholder="Doe"
            required
          />
          {errors.lastName && <p className="text-xs text-error mt-1">{errors.lastName}</p>}
        </div>
      </div>

      {/* Email, Gender, and Club */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-secondary mb-2">
            Email Address <span className="text-error">*</span>
          </label>
          <input
            type="email"
            className={`input w-full bg-surface-3 ${errors.email ? 'border-error' : ''}`}
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="john.doe@example.com"
            required
            readOnly={!!formData.email} // Pre-filled from Clerk, but allow editing if needed
          />
          {errors.email && <p className="text-xs text-error mt-1">{errors.email}</p>}
        </div>

        {/* Gender */}
        <GenderSelector
          value={formData.gender}
          onChange={(value) => updateField('gender', value)}
          label="Gender"
          required
          error={errors.gender}
        />

        {/* Club */}
        <div>
          <label className="block text-sm font-semibold text-secondary mb-2">
            Club <span className="text-error">*</span>
          </label>
          <select
            className={`input w-full ${errors.clubId ? 'border-error' : ''}`}
            value={formData.clubId}
            onChange={(e) => updateField('clubId', e.target.value)}
            required
          >
            <option value="">Select Club</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
                {club.city && ` - ${club.city}`}
              </option>
            ))}
          </select>
          {errors.clubId && <p className="text-xs text-error mt-1">{errors.clubId}</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
        <button type="submit" className="btn btn-secondary px-8">
          Continue to Optional Info
        </button>
      </div>
    </form>
  );
}

