'use client';

import { useState, useEffect } from 'react';
import { UserProfile, RoleInfo } from '@/types';

interface AppAdminDashboardProps {
  currentUser: UserProfile;
  onActAs: (playerId: string) => void;
}

interface PlayerForActAs {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  isAppAdmin: boolean;
}

export default function AppAdminDashboard({ currentUser, onActAs }: AppAdminDashboardProps) {
  const [players, setPlayers] = useState<PlayerForActAs[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const response = await fetch('/api/admin/act-as');
      if (response.ok) {
        const data = await response.json();
        setPlayers(data.players);
      }
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActAs = async () => {
    if (!selectedPlayerId) return;
    
    try {
      const response = await fetch('/api/admin/act-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPlayerId: selectedPlayerId })
      });

      if (response.ok) {
        const data = await response.json();
        onActAs(selectedPlayerId);
        alert(data.message);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error acting as player:', error);
      alert('Failed to act as player');
    }
  };

  if (loading) {
    return <div className="p-4">Loading players...</div>;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <h2 className="text-lg font-semibold text-yellow-800 mb-4">
        🔧 App Admin Controls
      </h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Act As Player:
          </label>
          <div className="flex gap-2">
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a player to act as...</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.isAppAdmin && '👑 '}
                  {player.firstName} {player.lastName} 
                  {player.email && ` (${player.email})`}
                </option>
              ))}
            </select>
            <button
              onClick={handleActAs}
              disabled={!selectedPlayerId}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Act As
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p><strong>Current User:</strong> {currentUser.firstName} {currentUser.lastName}</p>
          <p><strong>Email:</strong> {currentUser.email}</p>
          <p><strong>Role:</strong> App Admin</p>
        </div>
      </div>
    </div>
  );
}

