'use client';

/**
 * Bracket Lineup Editor
 *
 * For DE Club tournaments, allows setting lineups for each bracket separately.
 * Each bracket has its own teams with different rosters.
 */

import { useState, useEffect } from 'react';
import { fetchWithActAs } from '@/lib/fetchWithActAs';
import { expectedGenderForIndex } from '@/lib/lineupSlots';
import { PlayerLite } from '../shared/types';

interface BracketLineupEditorProps {
  matchId: string;
  stopId: string;
  brackets: Array<{
    bracketId: string;
    bracketName: string;
    teamA: { id: string; name: string };
    teamB: { id: string; name: string };
  }>;
  existingLineups: Record<string, Record<string, PlayerLite[]>>; // bracketId -> teamId -> players
  onSave: (lineups: Record<string, Record<string, PlayerLite[]>>) => void;
  onCancel: () => void;
}

export function BracketLineupEditor({
  matchId,
  stopId,
  brackets,
  existingLineups,
  onSave,
  onCancel,
}: BracketLineupEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [rosters, setRosters] = useState<Record<string, PlayerLite[]>>({});
  const [lineups, setLineups] = useState<Record<string, Record<string, (PlayerLite | undefined)[]>>>({});
  const [loadingRosters, setLoadingRosters] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);

  // Load rosters and initialize lineups
  useEffect(() => {
    loadRostersAndInitialize();
  }, [brackets, existingLineups]);

  async function loadRostersAndInitialize() {
    setLoadingRosters(true);
    setRosterError(null);

    try {
      // Fetch rosters for all teams
      const rosterPromises = brackets.flatMap(bracket => [
        fetchWithActAs(`/api/admin/stops/${stopId}/teams/${bracket.teamA.id}/roster`).then(r => r.json()).then(data => ({ teamId: bracket.teamA.id, roster: data.items || [] })),
        fetchWithActAs(`/api/admin/stops/${stopId}/teams/${bracket.teamB.id}/roster`).then(r => r.json()).then(data => ({ teamId: bracket.teamB.id, roster: data.items || [] })),
      ]);

      const rosterResults = await Promise.all(rosterPromises);

      const rostersMap: Record<string, PlayerLite[]> = {};
      rosterResults.forEach(({ teamId, roster }) => {
        rostersMap[teamId] = roster;
      });

      setRosters(rostersMap);

      // Initialize lineups from existing or create empty
      const initialLineups: Record<string, Record<string, (PlayerLite | undefined)[]>> = {};

      brackets.forEach(bracket => {
        initialLineups[bracket.bracketId] = {
          [bracket.teamA.id]: existingLineups[bracket.bracketId]?.[bracket.teamA.id] || [undefined, undefined, undefined, undefined],
          [bracket.teamB.id]: existingLineups[bracket.bracketId]?.[bracket.teamB.id] || [undefined, undefined, undefined, undefined],
        };
      });

      setLineups(initialLineups);

      // Validate rosters
      const issues: string[] = [];
      brackets.forEach(bracket => {
        const teamARoster = rostersMap[bracket.teamA.id] || [];
        const teamBRoster = rostersMap[bracket.teamB.id] || [];

        const teamAMen = teamARoster.filter(p => p.gender === 'MALE').length;
        const teamAWomen = teamARoster.filter(p => p.gender === 'FEMALE').length;
        const teamBMen = teamBRoster.filter(p => p.gender === 'MALE').length;
        const teamBWomen = teamBRoster.filter(p => p.gender === 'FEMALE').length;

        if (teamAMen < 2 || teamAWomen < 2) {
          issues.push(`${bracket.teamA.name} (${bracket.bracketName}) roster must have at least 2 men and 2 women.`);
        }
        if (teamBMen < 2 || teamBWomen < 2) {
          issues.push(`${bracket.teamB.name} (${bracket.bracketName}) roster must have at least 2 men and 2 women.`);
        }
      });

      if (issues.length > 0) {
        setRosterError(issues.join(' '));
      }
    } catch (error) {
      console.error('Failed to load rosters:', error);
      setRosterError('Failed to load team rosters. Please try again.');
    } finally {
      setLoadingRosters(false);
    }
  }

  const addPlayerToLineup = (bracketId: string, teamId: string, slotIndex: number, player: PlayerLite) => {
    const expectedGender = slotIndex < 2 ? 'MALE' : 'FEMALE';
    if (player.gender !== expectedGender) return;

    setLineups(prev => {
      const newLineups = { ...prev };
      const bracketLineups = { ...newLineups[bracketId] };
      const teamLineup = [...(bracketLineups[teamId] || [undefined, undefined, undefined, undefined])];

      // Remove player from other slots if exists
      for (let i = 0; i < teamLineup.length; i++) {
        if (teamLineup[i]?.id === player.id) {
          teamLineup[i] = undefined;
        }
      }

      // Add player to new slot
      teamLineup[slotIndex] = player;
      bracketLineups[teamId] = teamLineup;
      newLineups[bracketId] = bracketLineups;

      return newLineups;
    });
  };

  const removePlayerFromLineup = (bracketId: string, teamId: string, slotIndex: number) => {
    setLineups(prev => {
      const newLineups = { ...prev };
      const bracketLineups = { ...newLineups[bracketId] };
      const teamLineup = [...(bracketLineups[teamId] || [undefined, undefined, undefined, undefined])];
      teamLineup[slotIndex] = undefined;
      bracketLineups[teamId] = teamLineup;
      newLineups[bracketId] = bracketLineups;
      return newLineups;
    });
  };

  const getAvailablePlayers = (bracketId: string, teamId: string, slotIndex: number): PlayerLite[] => {
    const roster = rosters[teamId] || [];
    const teamLineup = lineups[bracketId]?.[teamId] || [];
    const expectedGender = expectedGenderForIndex(slotIndex);

    // Filter by gender
    const genderFiltered = roster.filter(p => p.gender === expectedGender);

    // Exclude players already in other slots
    const playersInOtherSlots = new Set(
      teamLineup.filter((p, idx) => p && idx !== slotIndex).map(p => p!.id)
    );

    return genderFiltered.filter(p => !playersInOtherSlots.has(p.id));
  };

  const isLineupValid = (lineup: (PlayerLite | undefined)[]): boolean => {
    return lineup.filter(p => p !== undefined).length === 4;
  };

  const areAllLineupsValid = (): boolean => {
    for (const bracket of brackets) {
      const teamALineup = lineups[bracket.bracketId]?.[bracket.teamA.id] || [];
      const teamBLineup = lineups[bracket.bracketId]?.[bracket.teamB.id] || [];
      if (!isLineupValid(teamALineup) || !isLineupValid(teamBLineup)) {
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      // Convert lineups to the format expected by parent
      const finalLineups: Record<string, Record<string, PlayerLite[]>> = {};

      brackets.forEach(bracket => {
        finalLineups[bracket.bracketId] = {
          [bracket.teamA.id]: (lineups[bracket.bracketId]?.[bracket.teamA.id] || []).filter(p => p !== undefined) as PlayerLite[],
          [bracket.teamB.id]: (lineups[bracket.bracketId]?.[bracket.teamB.id] || []).filter(p => p !== undefined) as PlayerLite[],
        };
      });

      await onSave(finalLineups);
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingRosters) {
    return (
      <div className="rounded-lg border border-subtle bg-surface-1 p-4">
        <div className="text-center text-muted">Loading rosters...</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-subtle bg-surface-1 p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Set Lineups for Each Bracket</h3>
        <div className="flex gap-2">
          <button
            className="btn btn-xs btn-primary disabled:opacity-50"
            onClick={handleSave}
            disabled={!areAllLineupsValid() || rosterError !== null || isSaving}
          >
            {isSaving ? 'Saving...' : 'Confirm All Lineups'}
          </button>
          <button
            className="btn btn-ghost btn-xs"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>

      {rosterError && (
        <div className="p-3 border border-warning/40 bg-warning/10 text-warning text-xs rounded">
          {rosterError}
        </div>
      )}

      {/* Lineup editor for each bracket */}
      {brackets.map(bracket => {
        const teamALineup = lineups[bracket.bracketId]?.[bracket.teamA.id] || [];
        const teamBLineup = lineups[bracket.bracketId]?.[bracket.teamB.id] || [];
        const teamARoster = rosters[bracket.teamA.id] || [];
        const teamBRoster = rosters[bracket.teamB.id] || [];

        return (
          <div key={bracket.bracketId} className="border border-border-subtle rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-3">
              {bracket.bracketName} Bracket
            </h4>

            <div className="grid grid-cols-2 gap-4">
              {/* Team A */}
              <div>
                <h5 className="text-xs font-medium mb-2 text-muted">{bracket.teamA.name}</h5>
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((slotIndex) => (
                    <div key={slotIndex} className="flex items-center gap-2">
                      <label className="text-xs font-medium w-4">{slotIndex + 1}:</label>
                      <select
                        disabled={rosterError !== null}
                        className={`flex-1 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary ${
                          rosterError ? 'bg-surface-2 text-muted cursor-not-allowed' : 'bg-surface-1 text-primary'
                        }`}
                        value={teamALineup[slotIndex]?.id || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            const player = teamARoster.find(p => p.id === e.target.value);
                            if (player) addPlayerToLineup(bracket.bracketId, bracket.teamA.id, slotIndex, player);
                          } else {
                            removePlayerFromLineup(bracket.bracketId, bracket.teamA.id, slotIndex);
                          }
                        }}
                      >
                        <option value="">Select Player {slotIndex + 1}</option>
                        {getAvailablePlayers(bracket.bracketId, bracket.teamA.id, slotIndex).map(player => (
                          <option key={player.id} value={player.id} className="bg-surface-1 text-primary">
                            {player.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team B */}
              <div>
                <h5 className="text-xs font-medium mb-2 text-muted">{bracket.teamB.name}</h5>
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((slotIndex) => (
                    <div key={slotIndex} className="flex items-center gap-2">
                      <label className="text-xs font-medium w-4">{slotIndex + 1}:</label>
                      <select
                        disabled={rosterError !== null}
                        className={`flex-1 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary ${
                          rosterError ? 'bg-surface-2 text-muted cursor-not-allowed' : 'bg-surface-1 text-primary'
                        }`}
                        value={teamBLineup[slotIndex]?.id || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            const player = teamBRoster.find(p => p.id === e.target.value);
                            if (player) addPlayerToLineup(bracket.bracketId, bracket.teamB.id, slotIndex, player);
                          } else {
                            removePlayerFromLineup(bracket.bracketId, bracket.teamB.id, slotIndex);
                          }
                        }}
                      >
                        <option value="">Select Player {slotIndex + 1}</option>
                        {getAvailablePlayers(bracket.bracketId, bracket.teamB.id, slotIndex).map(player => (
                          <option key={player.id} value={player.id} className="bg-surface-1 text-primary">
                            {player.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
