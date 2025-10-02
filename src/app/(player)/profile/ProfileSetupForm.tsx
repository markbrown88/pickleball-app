'use client';

import { useState } from 'react';

import { CA_PROVINCES, US_STATES, CountrySel } from '@/app/(player)/shared/useProfileData';

type ClubOption = {
  id: string;
  name: string;
};

type ProfileSetupUser = {
  firstName?: string | null;
  lastName?: string | null;
  emailAddresses?: Array<{ emailAddress: string }>;
  phoneNumbers?: Array<{ phoneNumber: string }>;
};

type ProfileSetupFormProps = {
  user: ProfileSetupUser | null;
  clubs: ClubOption[];
  onSave: (payload: {
    firstName: string;
    lastName: string;
    gender: 'MALE' | 'FEMALE';
    clubId: string;
    email: string;
    phone: string;
    city: string;
    region: string;
    country: string;
    dupr: string;
    birthday: string;
  }) => Promise<boolean>;
  loading: boolean;
};

export function ProfileSetup({ user, clubs, onSave, loading }: ProfileSetupFormProps) {
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    gender: 'MALE' as 'MALE' | 'FEMALE',
    clubId: '',
    email: user?.emailAddresses?.[0]?.emailAddress || '',
    phone: user?.phoneNumbers?.[0]?.phoneNumber || '',
    city: '',
    region: '',
    country: 'Canada',
    dupr: '',
    birthday: '',
  });
  const [countrySel, setCountrySel] = useState<CountrySel>('Canada');
  const [countryOther, setCountryOther] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const country = countrySel === 'Other' ? countryOther : countrySel;
    await onSave({ ...formData, country });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">First Name</label>
          <input
            type="text"
            required
            className="input"
            value={formData.firstName}
            onChange={(event) => setFormData((prev) => ({ ...prev, firstName: event.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Last Name</label>
          <input
            type="text"
            required
            className="input"
            value={formData.lastName}
            onChange={(event) => setFormData((prev) => ({ ...prev, lastName: event.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Gender</label>
          <select
            required
            className="input"
            value={formData.gender}
            onChange={(event) => setFormData((prev) => ({ ...prev, gender: event.target.value as 'MALE' | 'FEMALE' }))}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Club</label>
          <select
            required
            className="input"
            value={formData.clubId}
            onChange={(event) => setFormData((prev) => ({ ...prev, clubId: event.target.value }))}
          >
            <option value="">Select Club</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Email</label>
          <input
            type="email"
            className="input"
            value={formData.email}
            onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Phone</label>
          <input
            type="tel"
            className="input"
            value={formData.phone}
            onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">City</label>
          <input
            type="text"
            className="input"
            value={formData.city}
            onChange={(event) => setFormData((prev) => ({ ...prev, city: event.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">
            {countrySel === 'Canada' ? 'Province' : 'State'}
          </label>
          <select
            className="input"
            value={formData.region}
            onChange={(event) => setFormData((prev) => ({ ...prev, region: event.target.value }))}
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
          <label className="block text-sm font-medium text-muted mb-1">Country</label>
          <select
            className="input"
            value={countrySel}
            onChange={(event) => {
              const sel = event.target.value as CountrySel;
              setCountrySel(sel);
              setFormData((prev) => ({ ...prev, region: '' }));
            }}
          >
            <option value="Canada">Canada</option>
            <option value="USA">USA</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {countrySel === 'Other' && (
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Country Name</label>
          <input
            type="text"
            className="input"
            value={countryOther}
            onChange={(event) => setCountryOther(event.target.value)}
            placeholder="Enter country name"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">DUPR Rating (optional)</label>
          <input
            type="number"
            step="0.1"
            min="1.0"
            max="6.0"
            className="input"
            value={formData.dupr}
            onChange={(event) => setFormData((prev) => ({ ...prev, dupr: event.target.value }))}
            placeholder="e.g., 4.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Birthday (optional)</label>
          <input
            type="date"
            className="input"
            value={formData.birthday}
            onChange={(event) => setFormData((prev) => ({ ...prev, birthday: event.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating Profile…' : 'Create Profile'}
        </button>
      </div>
    </form>
  );
}

