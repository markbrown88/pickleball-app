/**
 * Example Usage of MatchupDragDrop Component
 *
 * This file demonstrates how to integrate the MatchupDragDrop component
 * into your EventManagerTab or other components.
 */

import { useState } from 'react';
import { MatchupDragDrop } from './MatchupDragDrop';
import { fetchWithActAs } from '@/lib/fetchWithActAs';

type Match = {
  id: string;
  teamA?: { id: string; name: string; bracketName?: string | null } | null;
  teamB?: { id: string; name: string; bracketName?: string | null } | null;
  round?: { stopId?: string };
};

export function MatchupDragDropExample() {
  // Example state management
  const [roundMatchups, setRoundMatchups] = useState<{ [roundId: string]: Match[] }>({
    'round-1': [
      {
        id: 'match-1',
        teamA: { id: 'team-1', name: 'Thunder Strikers', bracketName: 'A' },
        teamB: { id: 'team-2', name: 'Lightning Bolts', bracketName: 'A' },
      },
      {
        id: 'match-2',
        teamA: { id: 'team-3', name: 'Fire Dragons', bracketName: 'A' },
        teamB: { id: 'team-4', name: 'Ice Warriors', bracketName: 'A' },
      },
    ]
  });

  const selectedRoundId = 'round-1';
  const bracketName = 'A';

  // Get matches for the selected round and bracket
  const allMatches = roundMatchups[selectedRoundId] || [];
  const bracketMatches = allMatches.filter(match =>
    (match.teamA?.bracketName || match.teamB?.bracketName) === bracketName
  );

  // Handler to update matches when drag and drop completes
  const handleMatchesUpdate = (updatedBracketMatches: Match[]) => {
    // Rebuild the full matches array with updated bracket matches
    const newMatches = [...allMatches];

    // Find and update each bracket match in the full array
    updatedBracketMatches.forEach((updatedMatch, idx) => {
      const globalIndex = newMatches.findIndex(m => m.id === updatedMatch.id);
      if (globalIndex !== -1) {
        newMatches[globalIndex] = updatedMatch;
      }
    });

    // Update state
    setRoundMatchups(prev => ({
      ...prev,
      [selectedRoundId]: newMatches
    }));
  };

  // Auto-save function to persist changes to the backend
  const autoSaveRoundMatchups = async () => {
    const matches = roundMatchups[selectedRoundId];
    if (!matches || matches.length === 0) return;

    const stopId = matches[0]?.round?.stopId;
    if (!stopId) return;

    try {
      const response = await fetchWithActAs(
        `/api/manager/stops/${stopId}/rounds/${selectedRoundId}/matchups`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchups: matches.map(m => ({
              matchId: m.id,
              teamAId: m.teamA?.id || null,
              teamBId: m.teamB?.id || null,
            }))
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save matchups');
      }

    } catch (error) {
      console.error('Error saving matchups:', error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Matchup Management</h2>

      <MatchupDragDrop
        roundId={selectedRoundId}
        bracketName={bracketName}
        matches={bracketMatches}
        onMatchesUpdate={handleMatchesUpdate}
        onSave={autoSaveRoundMatchups}
      />
    </div>
  );
}

/**
 * Integration Guide:
 *
 * 1. Import the component:
 *    import { MatchupDragDrop } from './components/MatchupDragDrop';
 *
 * 2. Prepare your matches data:
 *    - Filter matches by round and bracket
 *    - Ensure each match has teamA and teamB properties
 *
 * 3. Implement the update handler:
 *    - Merge updated bracket matches back into your full matches array
 *    - Update your state with the new matches
 *
 * 4. Optional: Implement auto-save:
 *    - Create an async function that saves to your backend
 *    - Pass it as the onSave prop
 *
 * 5. Render the component:
 *    <MatchupDragDrop
 *      roundId={selectedRoundId}
 *      bracketName={bracketName}
 *      matches={bracketMatches}
 *      onMatchesUpdate={handleMatchesUpdate}
 *      onSave={autoSaveRoundMatchups}
 *    />
 */
