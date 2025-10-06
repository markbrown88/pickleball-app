'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Club, Player } from '@/types';

interface PlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (player: Partial<Player>) => Promise<void>;
  player?: Player | null;
  clubs: Club[];
}

export default function PlayerModal({ isOpen, onClose, onSave, player, clubs }: PlayerModalProps) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    gender: 'MALE' as 'MALE' | 'FEMALE',
    clubId: '',
    duprSingles: '',
    duprDoubles: '',
    clubRatingSingles: '',
    clubRatingDoubles: '',
    city: '',
    region: '',
    country: 'Canada',
    phone: '',
    email: '',
    birthday: '', // YYYY/MM/DD format
    displayAge: true,
    displayLocation: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (player) {
      // Convert birthday to YYYY/MM/DD format
      let birthday = '';
      if (player.birthday) {
        const date = new Date(player.birthday);
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        birthday = `${year}/${month}/${day}`;
      }
      
      setForm({
        firstName: player.firstName || '',
        lastName: player.lastName || '',
        gender: player.gender || 'MALE',
        clubId: player.clubId || '',
        duprSingles: player.duprSingles?.toString() || '',
        duprDoubles: player.duprDoubles?.toString() || '',
        clubRatingSingles: player.clubRatingSingles?.toString() || '',
        clubRatingDoubles: player.clubRatingDoubles?.toString() || '',
        city: player.city || '',
        region: player.region || '',
        country: player.country || 'Canada',
        phone: player.phone || '',
        email: player.email || '',
        birthday: birthday,
        displayAge: player.displayAge ?? true,
        displayLocation: player.displayLocation ?? true,
      });
    } else {
      setForm({
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
        country: 'Canada',
        phone: '',
        email: '',
        birthday: '',
        displayAge: true,
        displayLocation: true,
      });
    }
    setErrors({});
  }, [player, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!form.clubId) newErrors.clubId = 'Primary Club is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';

    // Email validation
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone validation (10 digits)
    if (form.phone.trim()) {
      const phoneDigits = form.phone.replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
        newErrors.phone = 'Phone must be 10 digits';
      }
    }

    // Birthday validation (YYYY/MM/DD format)
    if (form.birthday.trim()) {
      const birthdayRegex = /^\d{4}\/\d{2}\/\d{2}$/;
      if (!birthdayRegex.test(form.birthday.trim())) {
        newErrors.birthday = 'Birthday must be in YYYY/MM/DD format';
      } else {
        // Validate the actual date
        const [year, month, day] = form.birthday.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
          newErrors.birthday = 'Please enter a valid date';
        }
      }
    }

    // DUPR Singles validation
    if (form.duprSingles && (isNaN(Number(form.duprSingles)) || Number(form.duprSingles) < 1 || Number(form.duprSingles) > 7)) {
      newErrors.duprSingles = 'DUPR Singles must be between 1.0 and 7.0';
    }

    // DUPR Doubles validation
    if (form.duprDoubles && (isNaN(Number(form.duprDoubles)) || Number(form.duprDoubles) < 1 || Number(form.duprDoubles) > 7)) {
      newErrors.duprDoubles = 'DUPR Doubles must be between 1.0 and 7.0';
    }

    // Club Rating Singles validation
    if (form.clubRatingSingles && (isNaN(Number(form.clubRatingSingles)) || Number(form.clubRatingSingles) < 1 || Number(form.clubRatingSingles) > 7)) {
      newErrors.clubRatingSingles = 'Club Rating Singles must be between 1.0 and 7.0';
    }

    // Club Rating Doubles validation
    if (form.clubRatingDoubles && (isNaN(Number(form.clubRatingDoubles)) || Number(form.clubRatingDoubles) < 1 || Number(form.clubRatingDoubles) > 7)) {
      newErrors.clubRatingDoubles = 'Club Rating Doubles must be between 1.0 and 7.0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Parse birthday from YYYY/MM/DD format
      let birthday = null;
      if (form.birthday.trim()) {
        const [year, month, day] = form.birthday.split('/').map(Number);
        birthday = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
      }

      // Format phone number
      let formattedPhone = form.phone.trim();
      if (formattedPhone) {
        const phoneDigits = formattedPhone.replace(/\D/g, '');
        if (phoneDigits.length === 10) {
          formattedPhone = `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`;
        }
      }

      const playerData = {
        ...form,
        duprSingles: form.duprSingles ? Number(form.duprSingles) : null,
        duprDoubles: form.duprDoubles ? Number(form.duprDoubles) : null,
        clubRatingSingles: form.clubRatingSingles ? Number(form.clubRatingSingles) : null,
        clubRatingDoubles: form.clubRatingDoubles ? Number(form.clubRatingDoubles) : null,
        phone: formattedPhone,
        birthday,
      };

      await onSave(playerData);
      onClose();
    } catch (error: any) {
      console.error('Error saving player:', error);
      
      // Handle specific error cases
      if (error?.message?.includes('email already exists')) {
        setErrors({ email: 'A player with this email already exists' });
      } else if (error?.message) {
        setErrors({ general: error.message });
      } else {
        setErrors({ general: 'Failed to save player. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePhoneChange = (value: string) => {
    // Remove all non-digits
    const phoneDigits = value.replace(/\D/g, '');
    
    // Limit to 10 digits
    const limitedDigits = phoneDigits.slice(0, 10);
    
    // Format as (###) ###-####
    let formatted = limitedDigits;
    if (limitedDigits.length >= 6) {
      formatted = `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
    } else if (limitedDigits.length >= 3) {
      formatted = `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
    } else if (limitedDigits.length > 0) {
      formatted = `(${limitedDigits}`;
    }
    
    handleChange('phone', formatted);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={player ? 'Edit Player' : 'Add Player'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* General Error Display */}
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-600 text-sm">{errors.general}</p>
          </div>
        )}


        {/* Profile Picture and Basic Info */}
        <div className="flex gap-6">
          {/* Profile Picture */}
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium mb-3">
              Profile Picture
            </label>
            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost mt-2"
              onClick={() => {/* TODO: Implement file upload */}}
            >
              Upload Photo
            </button>
            <p className="text-xs mt-1">JPG, PNG up to 2MB</p>
          </div>

          {/* Basic Info Fields */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
            <label className="block text-sm font-medium mb-1">
              First Name *
            </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  className={`input w-full ${errors.firstName ? 'border-red-500' : ''}`}
                  placeholder="Enter first name"
                />
                {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className={`input w-full ${errors.lastName ? 'border-red-500' : ''}`}
                  placeholder="Enter last name"
                />
                {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium mb-1">
                  Gender *
                </label>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => handleChange('gender', 'MALE')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
                      form.gender === 'MALE'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-900 hover:text-gray-900'
                    }`}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('gender', 'FEMALE')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
                      form.gender === 'FEMALE'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-900 hover:text-gray-900'
                    }`}
                  >
                    Female
                  </button>
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium mb-1">
                  Birthday
                </label>
                <input
                  type="text"
                  value={form.birthday}
                  onChange={(e) => handleChange('birthday', e.target.value)}
                  className={`input w-full ${errors.birthday ? 'border-red-500' : ''}`}
                  placeholder="YYYY/MM/DD"
                />
                {errors.birthday && <p className="text-red-500 text-sm mt-1">{errors.birthday}</p>}
              </div>

              <div className="md:col-span-6">
                <label className="block text-sm font-medium mb-1">
                  Primary Club *
                </label>
                <select
                  value={form.clubId}
                  onChange={(e) => handleChange('clubId', e.target.value)}
                  className={`input w-full ${errors.clubId ? 'border-red-500' : ''}`}
                >
                  <option value="">Select a club</option>
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}{club.city ? ` (${club.city})` : ''}
                    </option>
                  ))}
                </select>
                {errors.clubId && <p className="text-red-500 text-sm mt-1">{errors.clubId}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Email *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={`input w-full ${errors.email ? 'border-red-500' : ''}`}
              placeholder="Enter email address"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Phone
            </label>
            <div className="flex">
              <div className="flex items-center px-3 bg-gray-50 border border-gray-300 rounded-l-md">
                <span className="text-sm text-gray-700">CA +1</span>
              </div>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className={`flex-1 input rounded-l-none ${errors.phone ? 'border-red-500' : ''}`}
                placeholder="(###) ###-####"
              />
            </div>
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
          </div>
        </div>

        {/* Location */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              City
            </label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => handleChange('city', e.target.value)}
              className="input w-full"
              placeholder="Enter city"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Prov/State
            </label>
            <input
              type="text"
              value={form.region}
              onChange={(e) => handleChange('region', e.target.value)}
              className="input w-full"
              placeholder="Enter prov/state"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Country
            </label>
            <select
              value={form.country}
              onChange={(e) => handleChange('country', e.target.value)}
              className="input w-full"
            >
              <option value="Canada">Canada</option>
              <option value="USA">USA</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Ratings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">DUPR Rating</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-700 mb-1">Singles</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="7.0"
                  value={form.duprSingles}
                  onChange={(e) => handleChange('duprSingles', e.target.value)}
                  className={`input w-full ${errors.duprSingles ? 'border-red-500' : ''}`}
                  placeholder="1.0 - 7.0"
                />
                {errors.duprSingles && <p className="text-red-500 text-xs mt-1">{errors.duprSingles}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Doubles</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="7.0"
                  value={form.duprDoubles}
                  onChange={(e) => handleChange('duprDoubles', e.target.value)}
                  className={`input w-full ${errors.duprDoubles ? 'border-red-500' : ''}`}
                  placeholder="1.0 - 7.0"
                />
                {errors.duprDoubles && <p className="text-red-500 text-xs mt-1">{errors.duprDoubles}</p>}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Club Rating</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-700 mb-1">Singles</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="7.0"
                  value={form.clubRatingSingles}
                  onChange={(e) => handleChange('clubRatingSingles', e.target.value)}
                  className={`input w-full ${errors.clubRatingSingles ? 'border-red-500' : ''}`}
                  placeholder="1.0 - 7.0"
                />
                {errors.clubRatingSingles && <p className="text-red-500 text-xs mt-1">{errors.clubRatingSingles}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Doubles</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="7.0"
                  value={form.clubRatingDoubles}
                  onChange={(e) => handleChange('clubRatingDoubles', e.target.value)}
                  className={`input w-full ${errors.clubRatingDoubles ? 'border-red-500' : ''}`}
                  placeholder="1.0 - 7.0"
                />
                {errors.clubRatingDoubles && <p className="text-red-500 text-xs mt-1">{errors.clubRatingDoubles}</p>}
              </div>
            </div>
          </div>
        </div>


        {/* Privacy */}
        <div>
            <label className="block text-sm font-medium mb-1">Privacy</label>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleChange('displayAge', String(!form.displayAge))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors mr-3 ${
                    form.displayAge ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.displayAge ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div>
                  <label className="text-sm font-medium">Display Age</label>
                  <p className="text-xs">Show age to other players</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleChange('displayLocation', String(!form.displayLocation))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors mr-3 ${
                    form.displayLocation ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.displayLocation ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div>
                  <label className="text-sm font-medium">Display Location</label>
                  <p className="text-xs">Show city and region to other players</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : (player ? 'Update Player' : 'Add Player')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
