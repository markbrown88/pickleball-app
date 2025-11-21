'use client';

import { useState } from 'react';
import { formatPhoneInput } from '@/lib/phone';
import { CA_PROVINCES, US_STATES, CountrySel } from '@/app/(player)/shared/useProfileData';

type OptionalInfoData = {
  phone: string;
  city: string;
  region: string;
  country: string;
  birthday: string;
  duprSingles: string;
  duprDoubles: string;
  clubRatingSingles: string;
  clubRatingDoubles: string;
};

type OptionalInfoStepProps = {
  formData: OptionalInfoData;
  onUpdate: (updates: Partial<OptionalInfoData>) => void;
  onBack: () => void;
  onSave: () => void;
  onSkip: () => void;
  saving: boolean;
};

export function OptionalInfoStep({
  formData,
  onUpdate,
  onBack,
  onSave,
  onSkip,
  saving,
}: OptionalInfoStepProps) {
  const [countrySel, setCountrySel] = useState<CountrySel>(
    (formData.country === 'Canada' || formData.country === 'USA' || formData.country === 'Other'
      ? formData.country
      : 'Canada') as CountrySel
  );
  const [countryOther, setCountryOther] = useState(
    formData.country && !['Canada', 'USA'].includes(formData.country) ? formData.country : ''
  );

  const updateField = (field: keyof OptionalInfoData, value: string) => {
    onUpdate({ [field]: value });
  };

  const handleCountryChange = (value: CountrySel) => {
    setCountrySel(value);
    if (value === 'Other') {
      onUpdate({ country: countryOther || 'Other', region: '' });
    } else {
      onUpdate({ country: value, region: '' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCountry = countrySel === 'Other' ? countryOther : countrySel;
    onUpdate({ country: finalCountry });
    onSave();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary mb-2">Optional Information</h2>
        <p className="text-sm text-muted">
          You can add more details now or update them later in your profile settings.
        </p>
      </div>

      {/* Contact Information */}
      <div>
        <h3 className="text-lg font-semibold text-secondary mb-4">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">Phone Number</label>
            <input
              type="tel"
              className="input w-full"
              value={formData.phone}
              onChange={(e) => updateField('phone', formatPhoneInput(e.target.value))}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div>
        <h3 className="text-lg font-semibold text-secondary mb-4">Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">City</label>
            <input
              type="text"
              className="input w-full"
              value={formData.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder="Toronto"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">
              {countrySel === 'Canada' ? 'Province' : 'State'}
            </label>
            <select
              className="input w-full"
              value={formData.region}
              onChange={(e) => updateField('region', e.target.value)}
            >
              <option value="">Select {countrySel === 'Canada' ? 'Province' : 'State'}</option>
              {(countrySel === 'Canada' ? CA_PROVINCES : US_STATES).map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">Country</label>
            <select
              className="input w-full"
              value={countrySel}
              onChange={(e) => handleCountryChange(e.target.value as CountrySel)}
            >
              <option value="Canada">Canada</option>
              <option value="USA">USA</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        {countrySel === 'Other' && (
          <div className="mt-4">
            <label className="block text-sm font-semibold text-secondary mb-2">Country Name</label>
            <input
              type="text"
              className="input w-full"
              value={countryOther}
              onChange={(e) => {
                setCountryOther(e.target.value);
                onUpdate({ country: e.target.value });
              }}
              placeholder="Enter country name"
            />
          </div>
        )}
      </div>

      {/* Ratings */}
      <div>
        <h3 className="text-lg font-semibold text-secondary mb-4">Ratings</h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted mb-3">DUPR Ratings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-secondary mb-2">Singles</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="6.0"
                  className="input w-full"
                  value={formData.duprSingles}
                  onChange={(e) => updateField('duprSingles', e.target.value)}
                  placeholder="e.g., 4.5"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-2">Doubles</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="6.0"
                  className="input w-full"
                  value={formData.duprDoubles}
                  onChange={(e) => updateField('duprDoubles', e.target.value)}
                  placeholder="e.g., 4.5"
                />
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted mb-3">Club Ratings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-secondary mb-2">Singles</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  className="input w-full"
                  value={formData.clubRatingSingles}
                  onChange={(e) => updateField('clubRatingSingles', e.target.value)}
                  placeholder="e.g., 7.5"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-2">Doubles</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  className="input w-full"
                  value={formData.clubRatingDoubles}
                  onChange={(e) => updateField('clubRatingDoubles', e.target.value)}
                  placeholder="e.g., 7.5"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Birthday */}
      <div>
        <h3 className="text-lg font-semibold text-secondary mb-4">Personal Information</h3>
        <div>
          <label className="block text-sm font-semibold text-secondary mb-2">Birthday</label>
          <input
            type="date"
            className="input w-full"
            value={formData.birthday}
            onChange={(e) => updateField('birthday', e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-4 border-t border-border-subtle">
        <button type="button" onClick={onBack} className="btn btn-ghost">
          Back
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={onSkip} className="btn btn-ghost" disabled={saving}>
            Skip
          </button>
          <button type="submit" className="btn btn-secondary px-8" disabled={saving}>
            {saving ? 'Saving...' : 'Complete Profile'}
          </button>
        </div>
      </div>
    </form>
  );
}

