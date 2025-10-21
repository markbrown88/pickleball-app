'use client';

import { useState, useEffect } from 'react';
import { fetchWithActAs } from '@/lib/fetchWithActAs';
import { expectedGenderForIndex } from '@/lib/lineupSlots';
import { PlayerLite } from './types';

interface InlineLineupEditorProps {
  matchId: string;
  stopId: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  lineups: Record<string, Record<string, PlayerLite[]>>;
  onSave: (lineups: { teamA: PlayerLite[]; teamB: PlayerLite[] }) => void;
  onCancel: () => void;
  prefetchedTeamRosters?: { teamA?: PlayerLite[]; teamB?: PlayerLite[] };
  teamRosters: Record<string, PlayerLite[]>;
}

export function InlineLineupEditor({
  matchId,
  stopId,
  teamA,
  teamB,
  lineups,
  onSave,
  onCancel,
  prefetchedTeamRosters,
  teamRosters,
}: InlineLineupEditorProps) {
  const [teamALineup, setTeamALineup] = useState<(PlayerLite | undefined)[]>([undefined, undefined, undefined, undefined]);
  const [teamBLineup, setTeamBLineup] = useState<(PlayerLite | undefined)[]>([undefined, undefined, undefined, undefined]);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [loadedRosters, setLoadedRosters] = useState<{ teamA: PlayerLite[]; teamB: PlayerLite[] }>({ teamA: [], teamB: [] });
  const [rosterError, setRosterError] = useState<string | null>(null);

  // Fetch team rosters and initialize lineups when component mounts
  useEffect(() => {
    let isMounted = true;

    const loadRostersAndInitialize = async () => {
      if (!teamA.id || !teamB.id || !stopId) return;

      const initializeLineups = (teamARoster: PlayerLite[], teamBRoster: PlayerLite[]) => {
        const existingLineups = lineups[matchId];
        const rosterMapA = new Map(teamARoster.map((p) => [p.id, p]));
        const rosterMapB = new Map(teamBRoster.map((p) => [p.id, p]));

        if (existingLineups) {
          const teamALineupData = existingLineups[teamA.id] || [];
          const teamBLineupData = existingLineups[teamB.id] || [];

          setTeamALineup([
            rosterMapA.get(teamALineupData[0]?.id) || teamALineupData[0] || undefined,
            rosterMapA.get(teamALineupData[1]?.id) || teamALineupData[1] || undefined,
            rosterMapA.get(teamALineupData[2]?.id) || teamALineupData[2] || undefined,
            rosterMapA.get(teamALineupData[3]?.id) || teamALineupData[3] || undefined
          ]);

          setTeamBLineup([
            rosterMapB.get(teamBLineupData[0]?.id) || teamBLineupData[0] || undefined,
            rosterMapB.get(teamBLineupData[1]?.id) || teamBLineupData[1] || undefined,
            rosterMapB.get(teamBLineupData[2]?.id) || teamBLineupData[2] || undefined,
            rosterMapB.get(teamBLineupData[3]?.id) || teamBLineupData[3] || undefined
          ]);

          const allSelectedPlayers = new Set([
            ...teamALineupData.map((p: any) => p.id),
            ...teamBLineupData.map((p: any) => p.id)
          ].filter(Boolean));
          setSelectedPlayers(allSelectedPlayers);
        } else {
          setTeamALineup([undefined, undefined, undefined, undefined]);
          setTeamBLineup([undefined, undefined, undefined, undefined]);
          setSelectedPlayers(new Set());
        }
      };

      const validateAndApply = (teamARoster: PlayerLite[], teamBRoster: PlayerLite[]) => {
        if (!isMounted) return;

        setLoadedRosters({ teamA: teamARoster, teamB: teamBRoster });
        initializeLineups(teamARoster, teamBRoster);

        const issues: string[] = [];

        const teamAMen = teamARoster.filter(player => player?.gender === 'MALE').length;
        const teamAWomen = teamARoster.filter(player => player?.gender === 'FEMALE').length;
        const teamBMen = teamBRoster.filter(player => player?.gender === 'MALE').length;
        const teamBWomen = teamBRoster.filter(player => player?.gender === 'FEMALE').length;

        if (teamAMen < 2 || teamAWomen < 2) {
          issues.push(`${teamA.name} roster must include at least 2 men and 2 women for this stop before lineups can be edited.`);
        }

        if (teamBMen < 2 || teamBWomen < 2) {
          issues.push(`${teamB.name} roster must include at least 2 men and 2 women for this stop before lineups can be edited.`);
        }

        if (issues.length > 0) {
          setRosterError(issues.join(' '));
        } else {
          setRosterError(null);
        }
      };

      // ALWAYS fetch fresh roster data for this specific stop
      // Don't rely on cached teamRosters which may be from different rounds
      try {
        const [responseA, responseB] = await Promise.all([
          fetchWithActAs(`/api/admin/stops/${stopId}/teams/${teamA.id}/roster`),
          fetchWithActAs(`/api/admin/stops/${stopId}/teams/${teamB.id}/roster`)
        ]);

        const [dataA, dataB] = await Promise.all([
          responseA.json(),
          responseB.json()
        ]);

        const rosterA = dataA.items || [];
        const rosterB = dataB.items || [];

        validateAndApply(rosterA, rosterB);
      } catch (error) {
        console.error('Failed to load stop-specific rosters:', error);
        if (!isMounted) return;
        setLoadedRosters({ teamA: [], teamB: [] });
        setRosterError('Unable to load rosters for this stop. Please create stop rosters before editing lineups.');
      }
    };

    loadRostersAndInitialize();

    return () => {
      isMounted = false;
    };
  }, [matchId, teamA.id, teamB.id, stopId, prefetchedTeamRosters, teamRosters, lineups]);

  const addPlayerToLineup = (player: PlayerLite, teamId: string, slotIndex: number) => {
    const isTeamA = teamId === teamA.id;
    const currentLineup = isTeamA ? teamALineup : teamBLineup;
    const currentPlayer = currentLineup[slotIndex];

    // Check gender constraints: slots 0,1 are male, slots 2,3 are female
    const expectedGender = slotIndex < 2 ? 'MALE' : 'FEMALE';
    if (player.gender !== expectedGender) return;

    // Update selectedPlayers first to avoid race conditions
    setSelectedPlayers(prev => {
      const newSet = new Set(prev);

      // Remove current player from selectedPlayers if there is one
      if (currentPlayer) {
        newSet.delete(currentPlayer.id);
      }

      // Remove the new player from selectedPlayers if they're already selected elsewhere
      if (newSet.has(player.id)) {
        newSet.delete(player.id);
      }

      // Add the new player
      newSet.add(player.id);

      return newSet;
    });

    // Update lineup state
    if (isTeamA) {
      setTeamALineup(prev => {
        const newLineup = [...prev];

        // Remove the new player from other slots if they exist
        for (let i = 0; i < newLineup.length; i++) {
          if (newLineup[i]?.id === player.id) {
            newLineup[i] = undefined;
          }
        }

        // Add player to the new slot
        newLineup[slotIndex] = player;
        return newLineup;
      });
    } else {
      setTeamBLineup(prev => {
        const newLineup = [...prev];

        // Remove the new player from other slots if they exist
        for (let i = 0; i < newLineup.length; i++) {
          if (newLineup[i]?.id === player.id) {
            newLineup[i] = undefined;
          }
        }

        // Add player to the new slot
        newLineup[slotIndex] = player;
        return newLineup;
      });
    }
  };

  const removePlayerFromLineup = (playerId: string, teamId: string, slotIndex: number) => {
    const isTeamA = teamId === teamA.id;

    // Update selectedPlayers first
    setSelectedPlayers(prev => {
      const newSet = new Set(prev);
      newSet.delete(playerId);
      return newSet;
    });

    // Update lineup state
    if (isTeamA) {
      setTeamALineup(prev => {
        const newLineup = [...prev];
        newLineup[slotIndex] = undefined as any;
        return newLineup;
      });
    } else {
      setTeamBLineup(prev => {
        const newLineup = [...prev];
        newLineup[slotIndex] = undefined as any;
        return newLineup;
      });
    }
  };

  const rosterReady =
    !rosterError &&
    loadedRosters.teamA.filter(player => player?.gender === 'MALE').length >= 2 &&
    loadedRosters.teamA.filter(player => player?.gender === 'FEMALE').length >= 2 &&
    loadedRosters.teamB.filter(player => player?.gender === 'MALE').length >= 2 &&
    loadedRosters.teamB.filter(player => player?.gender === 'FEMALE').length >= 2;

  const getAvailablePlayers = (teamId: string, slotIndex: number) => {
    const isTeamA = teamId === teamA.id;
    const roster = isTeamA ? loadedRosters.teamA : loadedRosters.teamB;
    const currentLineup = isTeamA ? teamALineup : teamBLineup;
    const currentPlayerInSlot = currentLineup[slotIndex];
    const expectedGender = expectedGenderForIndex(slotIndex);

    // Filter roster by gender first
    const genderFilteredRoster = roster.filter(p => p.gender === expectedGender);

    // Get IDs of players already in OTHER slots of the current lineup
    const playersInOtherSlots = new Set(
      currentLineup.filter((p, idx) => p && idx !== slotIndex).map(p => p!.id)
    );

    // A player is available if they are not in another slot in this lineup
    const availablePlayers = genderFilteredRoster.filter(p => !playersInOtherSlots.has(p.id));

    return availablePlayers;
  };

  const isLineupValid = (lineup: (PlayerLite | undefined)[]): boolean => {
    const menCount = lineup.filter(p => p?.gender === 'MALE').length;
    const womenCount = lineup.filter(p => p?.gender === 'FEMALE').length;
    return menCount >= 2 && womenCount >= 2;
  };

  const handleSave = async () => {
    if (isSaving) return; // Prevent double-clicks

    setIsSaving(true);
    try {
      await onSave({
        teamA: teamALineup.filter(p => p !== undefined) as PlayerLite[],
        teamB: teamBLineup.filter(p => p !== undefined) as PlayerLite[]
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-subtle bg-surface-1 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Edit Lineups</h3>
        <div className="flex gap-2">
          <button
            className="btn btn-xs btn-primary disabled:opacity-50"
            onClick={handleSave}
            disabled={!rosterReady || !isLineupValid(teamALineup) || !isLineupValid(teamBLineup) || isSaving}
          >
            {isSaving ? 'Saving...' : 'Confirm Lineup'}
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
        <div className="mb-3 p-3 border border-warning/40 bg-warning/10 text-warning text-xs rounded">
          {rosterError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Team A */}
        <div>
          <h4 className="text-xs font-medium mb-2 text-muted">{teamA.name}</h4>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((slotIndex) => (
              <div key={slotIndex} className="flex items-center gap-2">
                <label className="text-xs font-medium w-4">{slotIndex + 1}:</label>
                <select
                  disabled={!rosterReady}
                  className={`flex-1 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary ${
                    rosterReady ? 'bg-surface-1 text-primary' : 'bg-surface-2 text-muted cursor-not-allowed'
                  }`}
                  value={teamALineup[slotIndex]?.id || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const player = loadedRosters.teamA.find(p => p.id === e.target.value);
                      if (player) addPlayerToLineup(player, teamA.id, slotIndex);
                    } else if (teamALineup[slotIndex]) {
                      removePlayerFromLineup(teamALineup[slotIndex]!.id, teamA.id, slotIndex);
                    }
                  }}
                >
                  <option value="">{rosterReady ? `Select Player ${slotIndex + 1}` : 'Waiting for roster...'}</option>
                  {getAvailablePlayers(teamA.id, slotIndex).map(player => (
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
          <h4 className="text-xs font-medium mb-2 text-muted">{teamB.name}</h4>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((slotIndex) => (
              <div key={slotIndex} className="flex items-center gap-2">
                <label className="text-xs font-medium w-4">{slotIndex + 1}:</label>
                <select
                  disabled={!rosterReady}
                  className={`flex-1 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary ${
                    rosterReady ? 'bg-surface-1 text-primary' : 'bg-surface-2 text-muted cursor-not-allowed'
                  }`}
                  value={teamBLineup[slotIndex]?.id || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const player = loadedRosters.teamB.find(p => p.id === e.target.value);
                      if (player) addPlayerToLineup(player, teamB.id, slotIndex);
                    } else if (teamBLineup[slotIndex]) {
                      removePlayerFromLineup(teamBLineup[slotIndex]!.id, teamB.id, slotIndex);
                    }
                  }}
                >
                  <option value="">{rosterReady ? `Select Player ${slotIndex + 1}` : 'Waiting for roster...'}</option>
                  {getAvailablePlayers(teamB.id, slotIndex).map(player => (
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
}
