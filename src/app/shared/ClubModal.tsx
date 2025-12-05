'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { Player } from '@/types';
import { useFormValidation } from '@/hooks/useFormValidation';
import { clubValidationRules } from '@/lib/validation';
import { showSuccess, showError } from '@/lib/toast';

interface Club {
  id: string;
  fullName: string;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country: string;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  directorId?: string | null;
  logo?: string | null;
  director?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

interface ClubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (club: Partial<Club>) => Promise<void>;
  club?: Club | null;
  players?: Player[];
}

export default function ClubModal({ isOpen, onClose, onSave, club, players = [] }: ClubModalProps) {
  const [form, setForm] = useState({
    id: '',
    fullName: '',
    name: '',
    city: '',
    region: '',
    country: 'Canada',
    address: '',
    phone: '',
    email: '',
    description: '',
    directorId: '',
    directorName: '',
    logo: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const { errors, validateField, validateForm, clearErrors } = useFormValidation(clubValidationRules);
  const [directorSearch, setDirectorSearch] = useState('');
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [showDirectorDropdown, setShowDirectorDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (club) {
      const directorName = club.director?.firstName && club.director?.lastName 
        ? `${club.director.firstName} ${club.director.lastName}` 
        : '';
      
        setForm({
          id: club.id || '',
          fullName: club.fullName || '',
          name: club.name || '',
          city: club.city || '',
          region: club.region || '',
          country: club.country || 'Canada',
          address: club.address || '',
          phone: club.phone || '',
          email: club.email || '',
          description: club.description || '',
          directorId: club.directorId || '',
          directorName: directorName,
          logo: club.logo || '',
        });
      
      // Set the search input to show the director name
      setDirectorSearch(directorName);
    } else {
      setForm({
        id: '',
        fullName: '',
        name: '',
        city: '',
        region: '',
        country: 'Canada',
        address: '',
        phone: '',
        email: '',
        description: '',
        directorId: '',
        directorName: '',
        logo: '',
      });
      setDirectorSearch('');
    }
    clearErrors();
  }, [club, isOpen, clearErrors]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDirectorDropdown(false);
      }
    };

    if (showDirectorDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDirectorDropdown]);

  const handleFieldChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      validateField(field, value);
    }
  };

  const handleFieldBlur = (field: string) => {
    validateField(field, form[field as keyof typeof form]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const formErrors = validateForm(form);
    if (Object.keys(formErrors).length > 0) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave(form);
      showSuccess(club ? 'Club updated successfully!' : 'Club created successfully!');
      onClose();
    } catch (error: any) {
      console.error('Error saving club:', error);
      showError(error?.message || 'Failed to save club. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleDirectorSearch = (value: string) => {
    setDirectorSearch(value);
    if (value.length >= 3) {
      const filtered = players.filter(player => {
        const firstName = player.firstName || '';
        const lastName = player.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const searchTerm = value.toLowerCase();
        
        return firstName.toLowerCase().includes(searchTerm) ||
               lastName.toLowerCase().includes(searchTerm) ||
               fullName.toLowerCase().includes(searchTerm);
      });
      setFilteredPlayers(filtered);
      setShowDirectorDropdown(true);
    } else {
      setFilteredPlayers([]);
      setShowDirectorDropdown(false);
    }
  };

  const selectDirector = (player: Player) => {
    const fullName = `${player.firstName || ''} ${player.lastName || ''}`.trim();
    setForm(prev => ({
      ...prev,
      directorId: player.id,
      directorName: fullName
    }));
    setDirectorSearch(fullName);
    setShowDirectorDropdown(false);
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPG, PNG, etc.)');
        return;
      }
      
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB');
        return;
      }
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setForm(prev => ({ ...prev, logo: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={club ? 'Edit Club' : 'Add Club'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Error Display */}
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-600 text-sm">{errors.general}</p>
          </div>
        )}

        {/* Club Logo and Basic Info */}
        <div className="bg-surface-2 rounded-lg p-4 grid gap-4 lg:grid-cols-[200px,1fr]">
          {/* Club Logo - Landscape */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-primary">
              Club Logo
            </label>
            <div className="w-full max-w-xs h-24 bg-surface-1 rounded-lg flex items-center justify-center border-2 border-dashed border-border-medium overflow-hidden">
              {form.logo ? (
                <img 
                  src={form.logo} 
                  alt="Club logo preview" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={triggerFileUpload}
            >
              {form.logo ? 'Change Logo' : 'Upload Logo'}
            </button>
            <p className="text-xs text-muted">JPG, PNG up to 2MB</p>
          </div>

          {/* Basic Info Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => handleFieldChange('fullName', e.target.value)}
                onBlur={() => handleFieldBlur('fullName')}
                className={`input w-full ${errors.fullName ? 'border-red-500' : ''}`}
                placeholder="Enter full club name"
              />
              {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Nickname <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                onBlur={() => handleFieldBlur('name')}
                className={`input w-full ${errors.name ? 'border-red-500' : ''}`}
                placeholder="Enter club nickname"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Director <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={dropdownRef}>
                <input
                  type="text"
                  value={directorSearch}
                  onChange={(e) => handleDirectorSearch(e.target.value)}
                  className={`input w-full ${errors.director ? 'border-red-500' : ''}`}
                  placeholder="Type 3+ characters to search players"
                />
                {showDirectorDropdown && filteredPlayers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-surface-1 border border-border-medium rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredPlayers.map((player) => {
                      const fullName = `${player.firstName || ''} ${player.lastName || ''}`.trim();
                      return (
                        <div
                          key={player.id}
                          className="px-4 py-2 hover:bg-surface-2 cursor-pointer text-secondary font-medium"
                          onClick={() => selectDirector(player)}
                        >
                          {fullName || 'Unknown Player'}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {errors.director && <p className="text-red-500 text-sm mt-1">{errors.director}</p>}
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-surface-2 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => handleFieldChange('address', e.target.value)}
              onBlur={() => handleFieldBlur('address')}
              className={`input w-full ${errors.address ? 'border-red-500' : ''}`}
              placeholder="Enter club address"
            />
            {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleFieldChange('city', e.target.value)}
                onBlur={() => handleFieldBlur('city')}
                className={`input w-full ${errors.city ? 'border-red-500' : ''}`}
                placeholder="Enter city"
              />
              {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Prov/State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.region}
                onChange={(e) => handleFieldChange('region', e.target.value)}
                onBlur={() => handleFieldBlur('region')}
                className={`input w-full ${errors.region ? 'border-red-500' : ''}`}
                placeholder="Enter prov/state"
              />
              {errors.region && <p className="text-red-500 text-sm mt-1">{errors.region}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Country <span className="text-red-500">*</span>
              </label>
              <select
                value={form.country}
                onChange={(e) => handleFieldChange('country', e.target.value)}
                onBlur={() => handleFieldBlur('country')}
                className={`input w-full ${errors.country ? 'border-red-500' : ''}`}
              >
                <option value="Canada">Canada</option>
                <option value="USA">USA</option>
                <option value="Other">Other</option>
              </select>
              {errors.country && <p className="text-red-500 text-sm mt-1">{errors.country}</p>}
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-surface-2 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              onBlur={() => handleFieldBlur('email')}
              className={`input w-full ${errors.email ? 'border-red-500' : ''}`}
              placeholder="Enter email address"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              onBlur={() => handleFieldBlur('phone')}
              className="input w-full"
              placeholder="Enter phone number"
            />
          </div>
        </div>

        {/* Description */}
        <div className="bg-surface-2 rounded-lg p-4 space-y-2">
          <label className="block text-sm font-medium text-primary">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            onBlur={() => handleFieldBlur('description')}
            className={`input w-full ${errors.description ? 'border-red-500' : ''}`}
            rows={4}
            placeholder="Enter club description (max 300 characters)"
            maxLength={300}
          />
          <div className="flex justify-between text-xs text-muted">
            <span>{form.description.length}/300 characters</span>
          </div>
          {errors.description && <p className="text-red-500 text-sm">{errors.description}</p>}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
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
            {isLoading ? 'Saving...' : (club ? 'Update Club' : 'Add Club')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
