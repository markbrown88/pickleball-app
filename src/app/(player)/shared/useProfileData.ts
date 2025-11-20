import { useCallback, useEffect, useMemo, useState } from 'react';

import type { UserProfile } from '@/types';

export const CA_PROVINCES = [
  'AB',
  'BC',
  'MB',
  'NB',
  'NL',
  'NS',
  'NT',
  'NU',
  'ON',
  'PE',
  'QC',
  'SK',
  'YT',
] as const;

export const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
] as const;

export type CountrySel = 'Canada' | 'USA' | 'Other';

type ProfileBase = {
  clubRating?: number | null;
  photo?: string | null;
};

export type ProfileFormState = {
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  clubId: string;
  duprSingles: string;
  duprDoubles: string;
  clubRatingSingles: string;
  clubRatingDoubles: string;
  city: string;
  region: string;
  phone: string;
  email: string;
  displayAge: boolean;
  displayLocation: boolean;
  photo: string;
};

export type ProfileSetupFormState = {
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
};

export function fortyYearsAgoISO() {
  const t = new Date();
  t.setFullYear(t.getFullYear() - 40);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function ymdToDateString(y?: number | null, m?: number | null, d?: number | null) {
  if (!y || !m || !d) return '';
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

export function dateToLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type ProfileSetupUser = {
  firstName?: string | null;
  lastName?: string | null;
  emailAddresses?: Array<{ emailAddress: string }>;
  phoneNumbers?: Array<{ phoneNumber: string }>;
};

export function useProfileSetupForm(user: ProfileSetupUser | null) {
  const [formData, setFormData] = useState<ProfileSetupFormState>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    gender: 'MALE',
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

  const setField = useCallback(
    <K extends keyof ProfileSetupFormState>(key: K, value: ProfileSetupFormState[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const assignCountry = useCallback(
    (country: CountrySel | string) => {
      if (country === 'Canada' || country === 'USA') {
        setCountrySel(country);
        setCountryOther('');
        setField('country', country);
      } else {
        setCountrySel('Other');
        setCountryOther(country);
        setField('country', country);
      }
    },
    [setField],
  );

  const normalizedCountry = useMemo(() => {
    if (countrySel === 'Other') return countryOther;
    return countrySel;
  }, [countrySel, countryOther]);

  return {
    formData,
    setField,
    countrySel,
    setCountrySel,
    countryOther,
    setCountryOther,
    assignCountry,
    normalizedCountry,
  };
}

export function useProfileFormState(initialProfile: (UserProfile & ProfileBase) | null) {
  const [form, setForm] = useState<ProfileFormState>({
    firstName: '',
    lastName: '',
    gender: 'MALE',
    clubId: '',
    duprSingles: '',
    duprDoubles: '',
    clubRatingSingles: '',
    clubRatingDoubles: '',
    city: '',
    region: '',
    phone: '',
    email: '',
    displayAge: true,
    displayLocation: true,
    photo: '',
  });
  const [countrySel, setCountrySel] = useState<CountrySel>('Canada');
  const [countryOther, setCountryOther] = useState('');
  const [birthday, setBirthday] = useState<string>(fortyYearsAgoISO());

  const hydrateFromProfile = useCallback((profile: UserProfile & ProfileBase) => {
    const country = (profile.country || 'Canada') as string;
    const isKnownCountry = country === 'Canada' || country === 'USA';
    setCountrySel(isKnownCountry ? (country as CountrySel) : 'Other');
    setCountryOther(isKnownCountry ? '' : country);

    // Handle birthday - it may come as a Date object or ISO string from API
    let birthdayStr = fortyYearsAgoISO();
    if (profile.birthday) {
      if (profile.birthday instanceof Date) {
        birthdayStr = dateToLocalYMD(profile.birthday);
      } else if (typeof profile.birthday === 'string') {
        // Parse ISO string and convert to YYYY-MM-DD
        birthdayStr = profile.birthday.slice(0, 10);
      }
    }
    setBirthday(birthdayStr);
    setForm({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      gender: profile.gender || 'MALE',
      clubId: profile.club?.id || '',
      duprSingles: (profile as any).duprSingles != null ? String((profile as any).duprSingles) : '',
      duprDoubles: (profile as any).duprDoubles != null ? String((profile as any).duprDoubles) : '',
      clubRatingSingles: (profile as any).clubRatingSingles != null ? String((profile as any).clubRatingSingles) : '',
      clubRatingDoubles: (profile as any).clubRatingDoubles != null ? String((profile as any).clubRatingDoubles) : '',
      city: profile.city || '',
      region: profile.region || '',
      phone: profile.phone || '',
      email: profile.email || '',
      displayAge: (profile as any).displayAge ?? true,
      displayLocation: (profile as any).displayLocation ?? true,
      photo: profile.photo || '',
    });
  }, []);

  useEffect(() => {
    if (initialProfile) {
      hydrateFromProfile(initialProfile);
    }
  }, [initialProfile, hydrateFromProfile]);

  return {
    form,
    setForm,
    countrySel,
    setCountrySel,
    countryOther,
    setCountryOther,
    birthday,
    setBirthday,
    hydrateFromProfile,
  };
}


