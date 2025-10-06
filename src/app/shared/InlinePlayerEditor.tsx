'use client';

import React, { useState, useEffect } from 'react';
import { Player, Club } from '@/types';

interface InlinePlayerEditorProps {
  player: Player;
  clubs: Club[];
  onSave: (playerId: string, updates: Partial<Player>) => Promise<void>;
  onCancel: () => void;
}

export default function InlinePlayerEditor({ player, clubs, onSave, onCancel }: InlinePlayerEditorProps) {
  const [form, setForm] = useState({
    firstName: player.firstName || '',
    lastName: player.lastName || '',
    gender: player.gender || 'MALE',
    clubId: player.clubId || '',
    dupr: player.duprSingles?.toString() || '',
    city: player.city || '',
    region: player.region || '',
    country: player.country || 'Canada',
    phone: player.phone || '',
    email: player.email || '',
    age: player.age?.toString() || '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updates = {
        ...form,
        dupr: form.dupr ? Number(form.dupr) : null,
        age: form.age ? Number(form.age) : null,
      };
      await onSave(player.id, updates);
    } catch (error) {
      console.error('Error saving player:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <tr className="bg-blue-50">
      <td className="py-2 pr-4">
        <input
          type="text"
          value={form.firstName}
          onChange={(e) => setForm(prev => ({ ...prev, firstName: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="input w-full text-sm"
          placeholder="First name"
        />
      </td>
      <td className="py-2 pr-4">
        <input
          type="text"
          value={form.lastName}
          onChange={(e) => setForm(prev => ({ ...prev, lastName: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="input w-full text-sm"
          placeholder="Last name"
        />
      </td>
      <td className="py-2 pr-4">
        <select
          value={form.gender}
          onChange={(e) => setForm(prev => ({ ...prev, gender: e.target.value as 'MALE' | 'FEMALE' }))}
          onKeyDown={handleKeyDown}
          className="input w-full text-sm"
        >
          <option value="MALE">M</option>
          <option value="FEMALE">F</option>
        </select>
      </td>
      <td className="py-2 pr-4">
        <select
          value={form.clubId}
          onChange={(e) => setForm(prev => ({ ...prev, clubId: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="input w-full text-sm"
        >
          <option value="">Select club</option>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-4">
        <input
          type="number"
          value={form.age}
          onChange={(e) => setForm(prev => ({ ...prev, age: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="input w-full text-sm"
          placeholder="Age"
        />
      </td>
      <td className="py-2 pr-4">
        <input
          type="number"
          step="0.1"
          min="1.0"
          max="7.0"
          value={form.dupr}
          onChange={(e) => setForm(prev => ({ ...prev, dupr: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="input w-full text-sm"
          placeholder="DUPR"
        />
      </td>
      <td className="py-2 pr-4">
        <input
          type="text"
          value={form.city}
          onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="input w-full text-sm"
          placeholder="City"
        />
      </td>
      <td className="py-2 pr-4">
        <input
          type="text"
          value={form.region}
          onChange={(e) => setForm(prev => ({ ...prev, region: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="input w-full text-sm"
          placeholder="Region"
        />
      </td>
      <td className="py-2 pr-4">
        <select
          value={form.country}
          onChange={(e) => setForm(prev => ({ ...prev, country: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="input w-full text-sm"
        >
          <option value="Canada">Canada</option>
          <option value="USA">USA</option>
          <option value="Other">Other</option>
        </select>
      </td>
      <td className="py-2 pr-4">
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="input w-full text-sm"
          placeholder="Phone"
        />
      </td>
      <td className="py-2 pr-2 text-right align-middle">
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="text-green-600 hover:text-green-700 p-1"
            title="Save (Ctrl+Enter)"
          >
            {isLoading ? '⏳' : '✓'}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-gray-600 hover:text-gray-700 p-1"
            title="Cancel (Esc)"
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}
